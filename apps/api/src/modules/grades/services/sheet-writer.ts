import { Band } from "../repositories/grades-sheets.repository";
import { gradeFor } from "../domain/grades.policy";
import { SheetPart, StoredScore, rankPositions, sumByKind, totalOf } from "../domain/sheet.policy";

/* The writes behind a mark sheet. Everything here runs inside the caller's transaction. */

export interface Evaluation { total: number | null; grade: string | null; remark: string | null; caScore: number | null; examScore: number | null }

/** Total, grade letter and remark for one student's scores (all null until every part is entered). */
export function evaluate(parts: SheetPart[], scores: StoredScore[], bands: Band[]): Evaluation {
    const total = totalOf(parts, scores);
    const band = total === null ? undefined : gradeFor(bands, total);
    return { total, grade: band?.grade ?? null, remark: band?.remark ?? null, caScore: sumByKind(parts, scores, "ca"), examScore: sumByKind(parts, scores, "exam") };
}

/** One sheet row is locked while it is changed, so two people saving the same sheet are handled one after the other. */
export async function lockSheet(tx: any, sheetId: string): Promise<void> {
    await tx.$queryRaw`SELECT "id" FROM "ResultSheet" WHERE "id" = ${sheetId} FOR UPDATE`;
}

/**
 * Bring a sheet's grades up to date: optionally recompute every student's total, grade and remark with `bands`
 * (done when publishing, so a scale changed during the term is applied), then give every student on the class list their
 * position (ties share one) and the number ranked. Only rows that actually change are written.
 * Students no longer on the class list keep their row but are not ranked.
 */
export async function recomputeSheet(tx: any, sheetId: string, parts: SheetPart[], bands: Band[], onList: Set<string>, opts: { regrade: boolean }): Promise<{ regraded: number; reranked: number }> {
    const grades = await tx.grade.findMany({ where: { sheetId }, include: { scores: true } });
    let regraded = 0, reranked = 0;

    const totals = new Map<string, number | null>();
    for (const g of grades) {
        const stored: StoredScore[] = g.scores.map((s: any) => ({ position: s.position, score: s.score, isAbsent: s.isAbsent }));
        const e = evaluate(parts, stored, bands);
        if (opts.regrade && (e.total !== g.total || e.grade !== g.grade || e.remark !== g.remark)) {
            await tx.grade.update({ where: { id: g.id }, data: { total: e.total, grade: e.grade, remark: e.remark, caScore: e.caScore, examScore: e.examScore } });
            regraded++;
        }
        totals.set(g.studentId, opts.regrade ? e.total : g.total);
    }
    const { positions, ranked } = rankPositions(grades.filter((g: any) => onList.has(g.studentId)).map((g: any) => ({ studentId: g.studentId, total: totals.get(g.studentId) ?? null })));
    for (const g of grades) {
        const want = onList.has(g.studentId) ? positions.get(g.studentId)!.position : null;
        const wantRanked = onList.has(g.studentId) && want !== null ? ranked : null;
        if (g.position !== want || g.totalStudents !== wantRanked) { await tx.grade.update({ where: { id: g.id }, data: { position: want, totalStudents: wantRanked } }); reranked++; }
    }
    return { regraded, reranked };
}
