import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { GradesSheetsRepository } from "../repositories/grades-sheets.repository";
import { mayWorkOnSheet } from "../services/grades-scope";
import { lockSheet, recomputeSheet } from "../services/sheet-writer";
import { gradesErrors } from "../domain/grades.errors";
import { SheetAction, SheetPart, StoredScore, isComplete, nextStatus, reopenPermission } from "../domain/sheet.policy";

interface Dependencies { gradesSheetsRepository: GradesSheetsRepository; auditService: AuditService }

const DONE: Record<SheetAction, string> = { submit: "submitted", approve: "approved", publish: "published", lock: "locked", reopen: "reopened" };

/*
| MOVE A MARK SHEET along its workflow: submit, approve, publish, lock, or reopen (back to draft). One transaction, and the
| sheet row is locked while it moves, so two people cannot move it at the same time. Every move is audited.
|  - submit   : ALL, or the teacher of that subject. Every student on the class list needs every part entered (or marked absent).
|  - approve  : grades.approve.
|  - publish  : grades.publish. Checks completeness again, applies the school's CURRENT scale to every grade, ranks the class, makes
|               the grades visible to students and guardians, and FREEZES the scale used with the sheet.
|  - lock     : grades.publish. A locked sheet is still visible; only a reopen can change it.
|  - reopen   : needs a reason. grades.approve while it is still being reviewed; grades.reopen once it is published or locked.
|               The grades are hidden from students and guardians at once.
*/
export class SheetTransitionUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(action: SheetAction, schoolId: string, classSubjectId: string, input: { reason?: string }, access: Access, actor: { userId: string }) {
        const repo = this.d.gradesSheetsRepository; const db = getTenantClient();
        const cs = await repo.classSubject(classSubjectId);
        if (!cs) throw gradesErrors.sheetNotFound();
        const owner = { staffId: cs.staffId, classTeacherId: cs.class.classTeacherId };
        const sheet = await repo.sheetOf(classSubjectId);

        // Nothing has been entered yet: only "submit" has something to say about that (everyone is missing)
        if (!sheet) {
            if (action !== "submit") throw gradesErrors.sheetNotFound();
            if (!access.can("grades.submit") || !mayWorkOnSheet(access, "grades.submit", owner)) throw gradesErrors.notYourSheet();
            const [students, parts] = await Promise.all([repo.studentsOnList(cs.classId, cs.termId), repo.partsFor(cs.class.level)]);
            if (students.length === 0) throw gradesErrors.emptyClass();
            throw gradesErrors.incomplete(students.map(e => ({ student: `${e.student.firstName} ${e.student.lastName}`.trim(), missing: parts.map(p => p.name) })));
        }

        if (action === "submit") { if (!access.can("grades.submit") || !mayWorkOnSheet(access, "grades.submit", owner)) throw gradesErrors.notYourSheet(); }
        else if (action === "approve") { if (!access.can("grades.approve")) throw gradesErrors.notAllowed("approve mark sheets"); }
        else if (action === "publish" || action === "lock") { if (!access.can("grades.publish")) throw gradesErrors.notAllowed(`${action} mark sheets`); }
        else if (!access.can(reopenPermission(sheet.status))) throw gradesErrors.notAllowed("reopen a mark sheet at this stage");

        if (nextStatus(action, sheet.status) === null) throw gradesErrors.illegalMove(action, sheet.status);

        const [students, bands] = await Promise.all([repo.studentsOnList(cs.classId, cs.termId), repo.bandsFor(cs.class.level)]);
        const onList = new Set(students.map(e => e.studentId));
        const now = new Date(); let regraded = 0;

        const to = await db.$transaction(async tx => {
            await lockSheet(tx, sheet.id);
            const fresh = await tx.resultSheet.findUnique({ where: { id: sheet.id } });
            const target = fresh ? nextStatus(action, fresh.status) : null;
            if (!fresh || target === null) throw gradesErrors.illegalMove(action, fresh?.status ?? "missing");
            const parts = fresh.components as unknown as SheetPart[];

            if (action === "submit" || action === "publish") {
                if (students.length === 0) throw gradesErrors.emptyClass();
                const grades = await tx.grade.findMany({ where: { sheetId: sheet.id }, include: { scores: true } });
                const by = new Map(grades.map(g => [g.studentId, g]));
                const missing = students.filter(e => !isComplete(parts, (by.get(e.studentId)?.scores ?? []).map(s => ({ position: s.position, score: s.score, isAbsent: s.isAbsent }) as StoredScore)))
                    .map(e => ({ student: `${e.student.firstName} ${e.student.lastName}`.trim(),
                        missing: parts.filter(p => !(by.get(e.studentId)?.scores ?? []).some(s => s.position === p.position && (s.isAbsent || s.score !== null))).map(p => p.name) }));
                if (missing.length) throw gradesErrors.incomplete(missing);
            }

            const data: Record<string, unknown> = { status: target };
            if (action === "submit")  Object.assign(data, { submittedAt: now, submittedById: actor.userId });
            if (action === "approve") Object.assign(data, { approvedAt: now, approvedById: actor.userId });
            if (action === "lock")    Object.assign(data, { lockedAt: now, lockedById: actor.userId });
            if (action === "publish") {
                // apply the current scale to every grade, rank the class, show the grades, and freeze the scale that was used
                regraded = (await recomputeSheet(tx, sheet.id, parts, bands, onList, { regrade: true })).regraded;
                await tx.grade.updateMany({ where: { sheetId: sheet.id }, data: { isPublished: true } });
                Object.assign(data, { publishedAt: now, publishedById: actor.userId, scale: bands as any });
            }
            if (action === "reopen") {
                await tx.grade.updateMany({ where: { sheetId: sheet.id }, data: { isPublished: false } });
                Object.assign(data, { submittedAt: null, submittedById: null, approvedAt: null, approvedById: null, publishedAt: null, publishedById: null, lockedAt: null, lockedById: null, scale: null,
                    reopenedAt: now, reopenedById: actor.userId, reopenReason: input.reason ?? null });
            }
            await tx.resultSheet.update({ where: { id: sheet.id }, data });
            return target;
        }, { maxWait: 5000, timeout: 30000 });

        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: `grades.sheet_${DONE[action]}`, entity: "ResultSheet", entityId: sheet.id,
            oldValue: { status: sheet.status },
            newValue: { status: to, class: cs.class.name, subject: cs.subject.name, term: `${cs.term.session?.name ?? ""} ${cs.term.name}`.trim(), students: students.length,
                ...(action === "publish" ? { regraded, scale: bands.map(b => `${b.grade} from ${b.minScore}`) } : {}), ...(action === "reopen" ? { reason: input.reason } : {}) },
        });
        return { classSubjectId, status: to };
    }
}
