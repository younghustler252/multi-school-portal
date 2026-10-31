import type { Access } from "../../../foundation/access.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { buildPaginationMeta } from "../../../shared/utils/pagination";
import { GradesSheetsRepository } from "../repositories/grades-sheets.repository";
import { NameRef, StudentRef, TermRef, staffRef, studentRef, termRef } from "../services/grades-presenter";
import { gradesViewWhere, mayViewSheet, mayWorkOnSheet, sheetsViewWhere } from "../services/grades-scope";
import { gradesErrors } from "../domain/grades.errors";
import { SheetPart, SheetStatus, StoredScore, canEditScores, isComplete, nextStatus, reopenPermission } from "../domain/sheet.policy";
import { ListGradesQueryType, ListSheetsQueryType } from "../dtos/grades-sheets.dto";

interface Dependencies { gradesSheetsRepository: GradesSheetsRepository }

/* ── GET /grades/sheets: the sheets a person may see, with status and how far along they are ── */
export class ListSheetsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: ListSheetsQueryType, access: Access) {
        const repo = this.d.gradesSheetsRepository; const db = getTenantClient();
        const term = query.termId ? { id: query.termId } : await repo.currentTerm();
        if (!term) return { data: [], meta: buildPaginationMeta(0, query.page, query.limit) };

        const where: Record<string, unknown> = { AND: [
            sheetsViewWhere(access), { termId: term.id },
            ...(query.classId ? [{ classId: query.classId }] : []), ...(query.subjectId ? [{ subjectId: query.subjectId }] : []),
            ...(query.status ? [query.status === "draft" ? { OR: [{ sheet: null }, { sheet: { status: "draft" } }] } : { sheet: { status: query.status } }] : []),
        ] };
        const [total, rows] = await Promise.all([
            db.classSubject.count({ where }),
            db.classSubject.findMany({ where, orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }], skip: (query.page - 1) * query.limit, take: query.limit,
                include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } }, staff: { select: { id: true, firstName: true, lastName: true } },
                           term: { select: { id: true, name: true, session: { select: { id: true, name: true } } } }, sheet: { select: { id: true, status: true } } } }),
        ]);
        // How far along: students on each class list, and how many have a complete set of scores (two grouped queries, not one per sheet)
        const classIds = [...new Set(rows.map(r => r.classId))]; const csIds = rows.map(r => r.id);
        const [onList, done] = await Promise.all([
            classIds.length ? db.enrolment.groupBy({ by: ["classId"], where: { classId: { in: classIds }, termId: term.id, status: { in: ["active", "completed"] } }, _count: { _all: true } }) : [],
            csIds.length ? db.grade.groupBy({ by: ["classSubjectId"], where: { classSubjectId: { in: csIds }, total: { not: null } }, _count: { _all: true } }) : [],
        ]);
        const listBy = new Map(onList.map(x => [x.classId, x._count._all])); const doneBy = new Map(done.map(x => [x.classSubjectId, x._count._all]));
        return {
            data: rows.map(r => ({
                classSubjectId: r.id, status: (r.sheet?.status ?? "draft") as SheetStatus, class: { id: r.class.id, name: r.class.name },
                subject: { id: r.subject.id, name: r.subject.name, code: r.subject.code }, teacher: staffRef(r.staff), term: termRef(r.term),
                students: listBy.get(r.classId) ?? 0, complete: doneBy.get(r.id) ?? 0,
            })),
            meta: buildPaginationMeta(total, query.page, query.limit),
        };
    }
}

export interface SheetStudentRow {
    student: StudentRef; scores: Array<{ position: number; score: number | null; absent: boolean }>;
    total: number | null; grade: string | null; remark: string | null; position: number | null;
}

/* ── GET /grades/sheets/:classSubjectId: one sheet, with every student on the class list ── */
export class GetSheetUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(classSubjectId: string, access: Access) {
        const repo = this.d.gradesSheetsRepository;
        const cs = await repo.classSubject(classSubjectId);
        if (!cs) throw gradesErrors.sheetNotFound();
        const owner = { staffId: cs.staffId, classTeacherId: cs.class.classTeacherId };
        if (!mayViewSheet(access, owner)) throw gradesErrors.cannotSee();

        const sheet = await repo.sheetOf(classSubjectId);
        const [students, grades, currentParts] = await Promise.all([repo.studentsOnList(cs.classId, cs.termId), sheet ? repo.gradesOfSheet(sheet.id) : Promise.resolve([]), repo.partsFor(cs.class.level)]);
        const status = (sheet?.status ?? "draft") as SheetStatus;
        const hasScores = grades.some(g => g.scores.length > 0);
        // A draft with nothing entered yet follows the school's CURRENT scheme; once scores exist, the sheet keeps the parts it started with.
        const parts: SheetPart[] = sheet && (hasScores || status !== "draft") ? (sheet.components as unknown as SheetPart[]) : currentParts;

        const gradeBy = new Map(grades.map(g => [g.studentId, g]));
        let complete = 0;
        const rows: SheetStudentRow[] = students.map(e => {
            const g = gradeBy.get(e.studentId);
            const stored: StoredScore[] = (g?.scores ?? []).map(s => ({ position: s.position, score: s.score, isAbsent: s.isAbsent }));
            if (isComplete(parts, stored)) complete++;
            return { student: studentRef(e.student), scores: parts.map(p => { const s = stored.find(x => x.position === p.position); return { position: p.position, score: s?.score ?? null, absent: s?.isAbsent ?? false }; }),
                total: g?.total ?? null, grade: g?.grade ?? null, remark: g?.remark ?? null, position: g?.position ?? null };
        });
        const can = (k: string) => access.can(k);
        return {
            id: sheet?.id ?? null, classSubjectId, status,
            class: { id: cs.class.id, name: cs.class.name } as NameRef, subject: { id: cs.subject.id, name: cs.subject.name, code: cs.subject.code }, teacher: staffRef(cs.staff), term: termRef(cs.term) as TermRef,
            parts, students: rows, summary: { students: rows.length, complete, incomplete: rows.length - complete },
            history: { submittedAt: sheet?.submittedAt ?? null, approvedAt: sheet?.approvedAt ?? null, publishedAt: sheet?.publishedAt ?? null, lockedAt: sheet?.lockedAt ?? null, reopenedAt: sheet?.reopenedAt ?? null, reopenReason: sheet?.reopenReason ?? null },
            can: {
                enter:   canEditScores(status) && can("grades.enter")  && mayWorkOnSheet(access, "grades.enter", owner),
                submit:  nextStatus("submit", status) !== null && can("grades.submit") && mayWorkOnSheet(access, "grades.submit", owner),
                approve: nextStatus("approve", status) !== null && can("grades.approve"),
                publish: nextStatus("publish", status) !== null && can("grades.publish"),
                lock:    nextStatus("lock", status) !== null && can("grades.publish"),
                reopen:  nextStatus("reopen", status) !== null && can(reopenPermission(status)),
            },
        };
    }
}

/* ── GET /grades: the results list (page at most 100). Staff see their scope; a student or guardian sees PUBLISHED results only. ── */
export class ListGradesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: ListGradesQueryType, access: Access) {
        const db = getTenantClient();
        const filters: Record<string, unknown>[] = [gradesViewWhere(access)];
        if (query.studentId) filters.push({ studentId: query.studentId });
        if (query.termId)    filters.push({ termId: query.termId });
        if (query.classId)   filters.push({ classSubject: { classId: query.classId } });
        if (query.subjectId) filters.push({ classSubject: { subjectId: query.subjectId } });
        const where = { AND: filters };
        const [total, rows] = await Promise.all([
            db.grade.count({ where }),
            db.grade.findMany({ where, orderBy: [{ term: { startDate: "desc" } }, { createdAt: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit,
                include: { scores: true, sheet: { select: { status: true, components: true } }, student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                           classSubject: { select: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } } } },
                           term: { select: { id: true, name: true, session: { select: { id: true, name: true } } } } } }),
        ]);
        return {
            data: rows.map(g => {
                const parts = g.sheet.components as unknown as SheetPart[];
                return {
                    id: g.id, student: studentRef(g.student), class: g.classSubject.class, subject: g.classSubject.subject, term: termRef(g.term), status: g.sheet.status,
                    scores: parts.map(p => { const s = g.scores.find(x => x.position === p.position); return { name: p.name, kind: p.kind, maxScore: p.maxScore, score: s?.score ?? null, absent: s?.isAbsent ?? false }; }),
                    total: g.total, grade: g.grade, remark: g.remark, position: g.position, outOf: g.totalStudents,
                };
            }),
            meta: buildPaginationMeta(total, query.page, query.limit),
        };
    }
}
