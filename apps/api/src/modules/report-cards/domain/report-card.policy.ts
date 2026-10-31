import { SheetPart, rankPositions } from "../../grades/domain/sheet.policy";
import { gradeFor } from "../../grades/domain/grades.policy";

/*
|--------------------------------------------------------------------------
| REPORT CARD POLICY (pure: no database, no clock)
| A report card is one student's results for one term, built ONLY from published or locked mark sheets.
|  - subjects: each published sheet gives the student's parts, total, grade, remark and subject position (already computed by the sheet)
|  - total score = sum of the subject totals, average = total / subjects counted (2 decimals)
|  - overall position: every student on the class list ranked by average. Ties share a position (80, 80, 70 is 1st, 1st, 3rd)
|  - a subject whose sheet is not published yet is listed as MISSING, never counted as 0
|  - the card keeps a frozen SNAPSHOT. A "fingerprint" of the sheets it was built from tells us when the card has gone STALE
|    (a sheet was published, reopened and published again, or another subject was published after the card was made)
| Status: draft (computed, remarks editable, hidden from families) -> published (frozen, visible) -> sent (guardians told)
|--------------------------------------------------------------------------
*/
export const REMARK_MAX = 500;
export const MAX_CARDS_PER_REQUEST = 200;
export const UNPUBLISH_REASON_MIN = 5;
export const SNAPSHOT_VERSION = 1;

export const CARD_STATUSES = ["draft", "generated", "published", "sent"] as const;   // "generated" is legacy and never used now
export type CardStatus = typeof CARD_STATUSES[number];
export type CardAction = "publish" | "unpublish" | "mark_sent";

/** Visible to students and guardians. */
export const isVisibleCard = (s: string): boolean => s === "published" || s === "sent";
/** Remarks and regeneration are allowed only while the card is not out. */
export const isEditableCard = (s: string): boolean => s === "draft" || s === "generated";

export function nextCardStatus(action: CardAction, status: string): CardStatus | null {
    if (action === "publish")   return isEditableCard(status) ? "published" : null;
    if (action === "unpublish") return isVisibleCard(status) ? "draft" : null;
    if (action === "mark_sent") return status === "published" ? "sent" : null;
    return null;
}

export interface Band { minScore: number; grade: string; remark: string; isPass: boolean }
export interface StoredScoreRow { position: number; score: number | null; isAbsent: boolean }

export interface PublishedSheet {
    classSubjectId: string;
    subjectName:    string;
    teacher:        string | null;
    parts:          SheetPart[];
    scale:          Band[] | null;          // the scale frozen when the sheet was published
    publishedAt:    Date | string | null;
    grades:         Map<string, { scores: StoredScoreRow[]; total: number | null; grade: string | null; remark: string | null; position: number | null; outOf: number | null }>;
}

export interface SubjectResult {
    classSubjectId: string; subjectName: string; teacher: string | null;
    parts: Array<{ position: number; name: string; kind: "ca" | "exam"; maxScore: number; score: number | null; absent: boolean }>;
    ca: number | null; exam: number | null; total: number | null;
    grade: string | null; remark: string | null; isPass: boolean | null; position: number | null; outOf: number | null;
}
export interface MissingSubject { classSubjectId: string; subjectName: string }

export interface StudentResult {
    subjects: SubjectResult[];
    missing: MissingSubject[];
    totalScore: number | null;
    averageScore: number | null;
    subjectsCounted: number;
    overallGrade: { grade: string; remark: string; isPass: boolean } | null;
    position: number | null;
    outOf: number;           // how many students on the list were ranked
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const sumKind = (parts: SheetPart[], scores: StoredScoreRow[], kind: "ca" | "exam"): number | null => {
    const mine = parts.filter(p => p.kind === kind);
    const got = mine.map(p => scores.find(s => s.position === p.position)).filter((s): s is StoredScoreRow => !!s && (s.isAbsent || s.score !== null));
    return got.length === 0 ? null : r2(got.reduce((n, s) => n + (s.isAbsent ? 0 : (s.score ?? 0)), 0));
};

/** Each published sheet's fingerprint: which sheets (and which publication of each) a card was built from. */
export function fingerprintOf(sheets: Array<{ classSubjectId: string; publishedAt: Date | string | null }>): string[] {
    return sheets.map(s => `${s.classSubjectId}@${s.publishedAt ? new Date(s.publishedAt).toISOString() : "none"}`).sort();
}
export const sameFingerprint = (a: string[] | null | undefined, b: string[]): boolean => !!a && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Results for EVERY student on the class list, with the overall position among them.
 * `allSubjects` is every subject the class has this term (so a sheet that is not published shows up as missing).
 * `bands` is the class level's current scale, used only for the OVERALL grade of the average.
 */
export function buildClassResults(input: {
    studentIds: string[]; sheets: PublishedSheet[]; allSubjects: MissingSubject[]; bands: Band[];
}): Map<string, StudentResult> {
    const published = new Set(input.sheets.map(s => s.classSubjectId));
    const missing = input.allSubjects.filter(s => !published.has(s.classSubjectId));
    const out = new Map<string, StudentResult>();

    for (const id of input.studentIds) {
        const subjects: SubjectResult[] = [];
        for (const sh of input.sheets) {
            const g = sh.grades.get(id);
            if (!g) continue;      // not on this sheet at all (cannot happen for a published sheet, but never invent a row)
            const band = g.total !== null && sh.scale ? gradeFor(sh.scale, g.total) : undefined;
            subjects.push({
                classSubjectId: sh.classSubjectId, subjectName: sh.subjectName, teacher: sh.teacher,
                parts: sh.parts.map(p => { const s = g.scores.find(x => x.position === p.position); return { position: p.position, name: p.name, kind: p.kind, maxScore: p.maxScore, score: s?.isAbsent ? 0 : (s?.score ?? null), absent: !!s?.isAbsent }; }),
                ca: sumKind(sh.parts, g.scores, "ca"), exam: sumKind(sh.parts, g.scores, "exam"), total: g.total,
                grade: g.grade, remark: g.remark, isPass: band ? band.isPass : null, position: g.position, outOf: g.outOf,
            });
        }
        subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
        const counted = subjects.filter(s => s.total !== null);
        const totalScore = counted.length ? r2(counted.reduce((n, s) => n + (s.total as number), 0)) : null;
        const averageScore = counted.length ? r2((totalScore as number) / counted.length) : null;
        const band = averageScore !== null ? gradeFor(input.bands, averageScore) : undefined;
        out.set(id, {
            subjects, missing, totalScore, averageScore, subjectsCounted: counted.length,
            overallGrade: band ? { grade: band.grade, remark: band.remark, isPass: band.isPass } : null,
            position: null, outOf: 0,
        });
    }

    const { positions, ranked } = rankPositions(input.studentIds.map(id => ({ studentId: id, total: out.get(id)!.averageScore })));
    for (const id of input.studentIds) { const r = out.get(id)!; r.position = positions.get(id)?.position ?? null; r.outOf = ranked; }
    return out;
}

export interface AttendanceSummary { marked: number; present: number; absent: number; late: number; excused: number }
export function summariseAttendance(rows: Array<{ status: string }>): AttendanceSummary {
    const n = { marked: rows.length, present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of rows) if (r.status === "present" || r.status === "absent" || r.status === "late" || r.status === "excused") n[r.status]++;
    return n;
}

export interface CardSnapshot {
    version: number;
    generatedAt: string;
    fingerprint: string[];
    session: string; term: string; class: { id: string; name: string; level: string | null };
    student: { id: string; firstName: string; lastName: string; admissionNumber: string | null; gender: string | null };
    result: StudentResult;
    attendance: AttendanceSummary | null;
}

/** What stops a card being published. `allowMissing` lets a school publish while some subjects are still unpublished (they show as "not yet available"). */
export function publishBlockers(snap: CardSnapshot, allowMissing: boolean): string[] {
    const out: string[] = [];
    if (snap.result.subjectsCounted === 0) out.push("No subject has a score yet");
    if (!allowMissing && snap.result.missing.length) out.push(`Not published yet: ${snap.result.missing.map(m => m.subjectName).join(", ")}`);
    return out;
}

/** Why a card no longer matches the sheets it was built from (empty = up to date). */
export function staleness(snap: CardSnapshot | null, current: string[]): { stale: boolean; reason: string | null } {
    if (!snap) return { stale: false, reason: null };
    if (sameFingerprint(snap.fingerprint, current)) return { stale: false, reason: null };
    const was = new Set(snap.fingerprint.map(f => f.split("@")[0])), now = new Set(current.map(f => f.split("@")[0]));
    const added = [...now].filter(x => !was.has(x)).length, removed = [...was].filter(x => !now.has(x)).length;
    const reason = removed ? "A mark sheet was reopened after this card was made"
        : added ? "More subjects were published after this card was made" : "A mark sheet was published again after this card was made";
    return { stale: true, reason };
}
