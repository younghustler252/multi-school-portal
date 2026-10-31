import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { GradesSheetsRepository } from "../repositories/grades-sheets.repository";
import { StudentRef, studentRef } from "../services/grades-presenter";
import { mayWorkOnSheet } from "../services/grades-scope";
import { evaluate, lockSheet, recomputeSheet } from "../services/sheet-writer";
import { gradesErrors } from "../domain/grades.errors";
import { SheetPart, StoredScore, canEditScores, mergeScores, problemWithScore } from "../domain/sheet.policy";
import { SaveScoresDtoType } from "../dtos/grades-sheets.dto";

export type ScoreSkipReason = "not_on_class_list" | "duplicate_entry" | "invalid_score";
export interface SaveScoresResult {
    status: string; saved: number; unchanged: number;
    skipped: Array<{ student: StudentRef | null; studentId: string; reason: ScoreSkipReason; message?: string }>;
    summary: { students: number; complete: number };
}
interface Dependencies { gradesSheetsRepository: GradesSheetsRepository; auditService: AuditService }

const show = (s?: StoredScore) => (!s ? "not entered" : s.isAbsent ? "ABS" : String(s.score));
const same = (a: StoredScore[], b: StoredScore[]) => JSON.stringify(a) === JSON.stringify(b);

/*
| SAVE SCORES on a DRAFT mark sheet (a batch of students; each carries the parts it changes).
|  - ALL, or the teacher of THIS subject (the class teacher alone may look, not enter).
|  - Only a draft can change. The sheet row is locked while saving, so two people saving at once are handled one after the other.
|  - Students must be on the class list. A student whose entry is not valid is SKIPPED WITH A REASON; the rest are saved.
|  - A part left empty is "not entered" (never 0). "absent" counts 0 in the total and shows as ABS. A total, grade and remark appear
|    only when every part is entered. Positions for the whole class are recomputed in the same transaction (ties share one).
|  - The sheet keeps the parts it started with. A draft with nothing entered yet follows the school's current scheme.
*/
export class SaveScoresUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, classSubjectId: string, dto: SaveScoresDtoType, access: Access, actor: { userId: string }): Promise<SaveScoresResult> {
        const repo = this.d.gradesSheetsRepository; const db = getTenantClient();
        const cs = await repo.classSubject(classSubjectId);
        if (!cs) throw gradesErrors.sheetNotFound();
        if (!access.can("grades.enter") || !mayWorkOnSheet(access, "grades.enter", { staffId: cs.staffId, classTeacherId: cs.class.classTeacherId })) throw gradesErrors.notYourSheet();

        const [students, bands, currentParts] = await Promise.all([repo.studentsOnList(cs.classId, cs.termId), repo.bandsFor(cs.class.level), repo.partsFor(cs.class.level)]);
        const onList = new Map(students.map(e => [e.studentId, studentRef(e.student)]));
        const existing = await repo.sheetOf(classSubjectId);
        if (existing && !canEditScores(existing.status)) throw gradesErrors.notEditable(existing.status);
        const sheet = existing ?? await repo.createSheet(classSubjectId, currentParts);

        const skipped: SaveScoresResult["skipped"] = []; const seen = new Set<string>(); const valid: SaveScoresDtoType["entries"] = [];
        for (const e of dto.entries) {
            if (seen.has(e.studentId)) { skipped.push({ student: onList.get(e.studentId) ?? null, studentId: e.studentId, reason: "duplicate_entry" }); continue; }
            seen.add(e.studentId);
            if (!onList.has(e.studentId)) { skipped.push({ student: null, studentId: e.studentId, reason: "not_on_class_list" }); continue; }
            valid.push(e);
        }

        let saved = 0, unchanged = 0; let status = sheet.status as string;
        const changes: Array<{ student: string; part: string; from: string; to: string }> = [];
        let parts: SheetPart[] = sheet.components as unknown as SheetPart[];

        await db.$transaction(async tx => {
            await lockSheet(tx, sheet.id);
            const fresh = await tx.resultSheet.findUnique({ where: { id: sheet.id } });
            if (!fresh || !canEditScores(fresh.status)) throw gradesErrors.notEditable(fresh?.status ?? "missing");
            status = fresh.status;
            const grades = await tx.grade.findMany({ where: { sheetId: sheet.id }, include: { scores: true } });
            parts = fresh.components as unknown as SheetPart[];
            if (!grades.some(g => g.scores.length > 0) && JSON.stringify(parts) !== JSON.stringify(currentParts)) {
                await tx.resultSheet.update({ where: { id: sheet.id }, data: { components: currentParts as any } });   // nothing entered yet: follow the current scheme
                parts = currentParts;
            }
            const gradeBy = new Map(grades.map(g => [g.studentId, g]));

            for (const e of valid) {
                const problem = e.scores.map(s => problemWithScore(parts, s)).find(p => p !== null);
                if (problem) { skipped.push({ student: onList.get(e.studentId)!, studentId: e.studentId, reason: "invalid_score", message: problem }); continue; }
                const g = gradeBy.get(e.studentId);
                const before: StoredScore[] = (g?.scores ?? []).map(s => ({ position: s.position, score: s.score, isAbsent: s.isAbsent })).sort((a, b) => a.position - b.position);
                const merged = mergeScores(before, e.scores);
                if (same(before, merged)) { unchanged++; continue; }

                const ev = evaluate(parts, merged, bands);
                const row = await tx.grade.upsert({
                    where: { studentId_termId_classSubjectId: { studentId: e.studentId, termId: cs.termId, classSubjectId } },
                    create: { studentId: e.studentId, termId: cs.termId, classSubjectId, sheetId: sheet.id, caScore: ev.caScore, examScore: ev.examScore, total: ev.total, grade: ev.grade, remark: ev.remark, isPublished: false },
                    update: { caScore: ev.caScore, examScore: ev.examScore, total: ev.total, grade: ev.grade, remark: ev.remark },
                });
                await tx.gradeScore.deleteMany({ where: { gradeId: row.id } });
                if (merged.length) await tx.gradeScore.createMany({ data: merged.map(s => ({ gradeId: row.id, position: s.position, score: s.score, isAbsent: s.isAbsent })) });
                for (const p of parts) {
                    const was = before.find(x => x.position === p.position), now = merged.find(x => x.position === p.position);
                    if (show(was) !== show(now)) changes.push({ student: onList.get(e.studentId)!.name, part: p.name, from: show(was), to: show(now) });
                }
                saved++;
            }
            await recomputeSheet(tx, sheet.id, parts, bands, new Set(onList.keys()), { regrade: false });
        }, { maxWait: 5000, timeout: 30000 });

        const complete = await db.grade.count({ where: { sheetId: sheet.id, total: { not: null }, studentId: { in: [...onList.keys()] } } });
        if (saved > 0) await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "grades.scores_saved", entity: "ResultSheet", entityId: sheet.id,
            newValue: { class: cs.class.name, subject: cs.subject.name, term: `${cs.term.session?.name ?? ""} ${cs.term.name}`.trim(), saved, unchanged, skipped: skipped.length, changes: changes.slice(0, 100) },
        });
        return { status, saved, unchanged, skipped, summary: { students: onList.size, complete } };
    }
}
