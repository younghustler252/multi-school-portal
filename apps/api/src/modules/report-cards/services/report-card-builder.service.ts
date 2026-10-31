import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import type { GradesSheetsRepository } from "../../grades/repositories/grades-sheets.repository";
import { SheetPart } from "../../grades/domain/sheet.policy";
import {
    Band, CardSnapshot, MissingSubject, PublishedSheet, SNAPSHOT_VERSION, StudentResult, buildClassResults, fingerprintOf, summariseAttendance,
} from "../domain/report-card.policy";
import { isVisibleSheet } from "./sheet-visibility";

interface Dependencies { reportCardsRepository: ReportCardsRepository; gradesSheetsRepository: GradesSheetsRepository }

export interface ClassContext {
    cls: { id: string; name: string; level: string | null; classTeacherId: string | null };
    term: { id: string; name: string; session: { id: string; name: string } };
    students: Array<{ id: string; firstName: string; lastName: string; admissionNumber: string | null; gender: string | null }>;
    subjects: Array<MissingSubject & { published: boolean }>;
    results: Map<string, StudentResult>;
    fingerprint: string[];
}

/*
| Reads a class's published mark sheets and turns them into results for EVERY student on the list (so the overall position is
| the real position in the class, whichever cards happen to exist). Only published or locked sheets are ever read.
*/
export class ReportCardBuilder {
    constructor(private readonly d: Dependencies) {}

    async loadClass(classId: string, termId: string): Promise<ClassContext | null> {
        const repo = this.d.reportCardsRepository;
        const [cls, term] = await Promise.all([repo.classOf(classId), repo.term(termId)]);
        if (!cls || !term) return null;
        const [list, subjectRows, bands] = await Promise.all([repo.studentsOnList(classId, termId), repo.subjectsWithSheets(classId, termId), this.d.gradesSheetsRepository.bandsFor(cls.level)]);

        const live = subjectRows.filter(s => s.sheet && isVisibleSheet(s.sheet.status));
        const grades = await repo.gradesForSheets(live.map(s => s.sheet!.id));
        const bySheet = new Map<string, PublishedSheet["grades"]>();
        for (const g of grades) {
            const m = bySheet.get(g.sheetId) ?? new Map(); 
            m.set(g.studentId, { scores: g.scores.map(s => ({ position: s.position, score: s.score, isAbsent: s.isAbsent })), total: g.total, grade: g.grade, remark: g.remark, position: g.position, outOf: g.totalStudents });
            bySheet.set(g.sheetId, m);
        }
        const sheets: PublishedSheet[] = live.map(s => ({
            classSubjectId: s.id, subjectName: s.subject.name, teacher: s.staff ? `${s.staff.firstName} ${s.staff.lastName}`.trim() : null,
            parts: (s.sheet!.components as unknown as SheetPart[]) ?? [], scale: (s.sheet!.scale as unknown as Band[] | null) ?? null,
            publishedAt: s.sheet!.publishedAt, grades: bySheet.get(s.sheet!.id) ?? new Map(),
        }));
        const allSubjects = subjectRows.map(s => ({ classSubjectId: s.id, subjectName: s.subject.name, published: !!(s.sheet && isVisibleSheet(s.sheet.status)) }));
        const students = list.map(e => e.student);
        const results = buildClassResults({ studentIds: students.map(s => s.id), sheets, allSubjects, bands });
        return { cls, term, students, subjects: allSubjects, results, fingerprint: fingerprintOf(sheets) };
    }

    /** Just the fingerprint of what is published for a class right now (one query), to tell whether a card has gone stale. */
    async currentFingerprint(classId: string, termId: string): Promise<string[]> {
        const rows = await this.d.reportCardsRepository.subjectsWithSheets(classId, termId);
        return fingerprintOf(rows.filter(s => s.sheet && isVisibleSheet(s.sheet.status)).map(s => ({ classSubjectId: s.id, publishedAt: s.sheet!.publishedAt })));
    }

    snapshotFor(ctx: ClassContext, studentId: string, attendance: Array<{ status: string }> | undefined, now: Date): CardSnapshot {
        const student = ctx.students.find(s => s.id === studentId)!;
        return {
            version: SNAPSHOT_VERSION, generatedAt: now.toISOString(), fingerprint: ctx.fingerprint,
            session: ctx.term.session.name, term: ctx.term.name, class: { id: ctx.cls.id, name: ctx.cls.name, level: ctx.cls.level },
            student: { id: student.id, firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber, gender: student.gender },
            result: ctx.results.get(studentId)!, attendance: attendance ? summariseAttendance(attendance) : null,
        };
    }
}
