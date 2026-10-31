/*
|--------------------------------------------------------------------------
| MARK SHEET RULES (pure: no database, easy to test)
| A sheet is one subject, in one class, for one term. Its status moves:
|   draft -> submitted -> approved -> published -> locked      (and back to draft by "reopen", with a reason)
| Scores can only be changed while the sheet is a draft.
|--------------------------------------------------------------------------
*/
export const SHEET_STATUSES = ["draft", "submitted", "approved", "published", "locked"] as const;
export type SheetStatus = typeof SHEET_STATUSES[number];
export type SheetAction = "submit" | "approve" | "publish" | "lock" | "reopen";

// A school setting later (results.require_approval); a constant until the settings service has it.
export const REQUIRE_APPROVAL = true;
export const REOPEN_REASON_MIN = 5;
export const MAX_SCORE_ENTRIES = 200;

export interface SheetPart { position: number; name: string; kind: "ca" | "exam"; maxScore: number }
export interface ScoreInput { position: number; score?: number | null; absent?: boolean }
export interface StoredScore { position: number; score: number | null; isAbsent: boolean }

/** The status a sheet moves to, or null when the move is not allowed from where it is. */
export function nextStatus(action: SheetAction, status: SheetStatus, requireApproval: boolean = REQUIRE_APPROVAL): SheetStatus | null {
    switch (action) {
        case "submit":  return status === "draft" ? "submitted" : null;
        case "approve": return status === "submitted" ? "approved" : null;
        case "publish": return status === "approved" || (!requireApproval && status === "submitted") ? "published" : null;
        case "lock":    return status === "published" ? "locked" : null;
        case "reopen":  return status === "draft" ? null : "draft";
    }
}

export const canEditScores = (status: SheetStatus): boolean => status === "draft";

/** Who may send a sheet back to draft: the approver while it is still being reviewed; only the reopen permission once it is out. */
export const reopenPermission = (status: SheetStatus): "grades.approve" | "grades.reopen" =>
    status === "submitted" || status === "approved" ? "grades.approve" : "grades.reopen";

/** Parents and students see a sheet only once it is published. */
export const isVisibleToFamilies = (status: SheetStatus): boolean => status === "published" || status === "locked";

const twoDecimals = (n: number) => Math.round(n * 100) / 100 === n;

/** Why one entered score is not acceptable, in plain words; null if it is fine. */
export function problemWithScore(parts: SheetPart[], s: ScoreInput): string | null {
    const part = parts.find(p => p.position === s.position);
    if (!part) return `There is no part number ${s.position} on this sheet`;
    if (s.absent && s.score !== undefined && s.score !== null) return `${part.name}: a student marked absent cannot also have a score`;
    if (s.score === undefined || s.score === null) return null;
    if (typeof s.score !== "number" || !Number.isFinite(s.score) || s.score < 0 || !twoDecimals(s.score)) return `${part.name}: the score must be a number from 0, with at most 2 decimals`;
    if (s.score > part.maxScore) return `${part.name}: the score cannot be more than ${part.maxScore}`;
    return null;
}

/** Put the new entries over what is already saved. An entry with no score and not absent clears that part (back to "not entered"). */
export function mergeScores(existing: StoredScore[], incoming: ScoreInput[]): StoredScore[] {
    const byPos = new Map(existing.map(s => [s.position, { ...s }]));
    for (const s of incoming) {
        const hasScore = s.score !== undefined && s.score !== null;
        if (!hasScore && !s.absent) byPos.delete(s.position);
        else byPos.set(s.position, { position: s.position, score: hasScore ? (s.score as number) : null, isAbsent: !!s.absent });
    }
    return [...byPos.values()].sort((a, b) => a.position - b.position);
}

/** Every part has a score or is marked absent. */
export const isComplete = (parts: SheetPart[], scores: StoredScore[]): boolean =>
    parts.every(p => { const s = scores.find(x => x.position === p.position); return !!s && (s.isAbsent || s.score !== null); });

/** The total out of 100. Not available until every part is entered; an absent part counts as 0. */
export function totalOf(parts: SheetPart[], scores: StoredScore[]): number | null {
    if (!isComplete(parts, scores)) return null;
    const sum = parts.reduce((n, p) => n + (scores.find(x => x.position === p.position)?.score ?? 0), 0);
    return Math.round(sum * 100) / 100;
}

/** The sum of the entered scores of one kind (for the older CA / exam columns). Null when none of that kind is entered. */
export function sumByKind(parts: SheetPart[], scores: StoredScore[], kind: "ca" | "exam"): number | null {
    const entered = parts.filter(p => p.kind === kind).map(p => scores.find(x => x.position === p.position)).filter(s => s && (s.isAbsent || s.score !== null));
    if (entered.length === 0) return null;
    return Math.round(entered.reduce((n, s) => n + (s!.score ?? 0), 0) * 100) / 100;
}

export interface Ranked { position: number | null }

/** Class positions for one subject. Ties share a position (80, 80, 70 is 1st, 1st, 3rd). Students with no total are not ranked. */
export function rankPositions(rows: Array<{ studentId: string; total: number | null }>): { positions: Map<string, Ranked>; ranked: number } {
    const withTotal = rows.filter((r): r is { studentId: string; total: number } => r.total !== null).sort((a, b) => b.total - a.total);
    const positions = new Map<string, Ranked>(rows.map(r => [r.studentId, { position: null }]));
    let place = 0, last: number | null = null;
    withTotal.forEach((r, i) => { if (last === null || r.total !== last) place = i + 1; last = r.total; positions.get(r.studentId)!.position = place; });
    return { positions, ranked: withTotal.length };
}
