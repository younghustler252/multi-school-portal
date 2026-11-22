import type {
	ScoreInput, ScoreSkipReason, SheetAction, SheetCan, SheetDetail, SheetPart, SheetStatus, SheetStudentRow, SkippedEntry,
} from "../types/sheet-contract.types";

/* Pure rules for the mark-sheet screens. The server owns totals, grades, positions and permissions; nothing here recomputes them. */

export const REOPEN_REASON_MIN = 5;
export const REOPEN_REASON_MAX = 500;

export const SHEET_STATUS_LABEL: Record<SheetStatus, string> = {
	draft: "Draft", submitted: "Submitted", approved: "Approved", published: "Published", locked: "Locked",
};

export const ACTION_LABEL: Record<SheetAction, string> = {
	submit: "Submit for approval", approve: "Approve", publish: "Publish", lock: "Lock", reopen: "Reopen",
};

/** Families see a sheet only once it is out. */
export const isOut = (s: SheetStatus): boolean => s === "published" || s === "locked";

/** The workflow actions to offer, straight from the server's `can` flags, in workflow order. Entering scores is not an action here. */
export function availableActions(can: SheetCan): SheetAction[] {
	const order: SheetAction[] = ["submit", "approve", "publish", "lock", "reopen"];
	return order.filter((a) => can[a]);
}

/** Names of the parts a student still lacks: no score and not marked absent. */
export function missingParts(parts: SheetPart[], row: SheetStudentRow): string[] {
	return parts
		.filter((p) => {
			const s = row.scores.find((x) => x.position === p.position);
			return !s || (s.score === null && !s.absent);
		})
		.map((p) => p.name);
}

export interface MissingRow { studentId: string; name: string; missing: string[] }
export function incompleteStudents(sheet: Pick<SheetDetail, "parts" | "students">): MissingRow[] {
	return sheet.students
		.map((r) => ({ studentId: r.student.id, name: r.student.name, missing: missingParts(sheet.parts, r) }))
		.filter((r) => r.missing.length > 0);
}

export function progressText(summary: { students: number; complete: number }): string {
	if (summary.students === 0) return "No students on this class list";
	return `${summary.complete} of ${summary.students} complete`;
}

/** Client-side check before sending; the server stays the authority. Null when fine. */
export function scoreProblem(part: SheetPart, raw: string): string | null {
	const t = raw.trim();
	if (t === "") return null; // empty clears the part
	if (!/^\d+(\.\d{1,2})?$/.test(t)) return `${part.name}: use a number from 0, with at most 2 decimals`;
	if (Number(t) > part.maxScore) return `${part.name}: cannot be more than ${part.maxScore}`;
	return null;
}

export interface CellEdit { studentId: string; position: number; raw: string; absent: boolean }

/**
 * Turn edited cells into the request body. A blank, not-absent cell clears the part ({position} only);
 * an absent cell sends absent:true with no score. Cells that match what is already saved are left out.
 * Invalid text is returned in `problems` and not sent.
 */
export function buildScoreEntries(sheet: Pick<SheetDetail, "parts" | "students">, edits: CellEdit[]): {
	entries: Array<{ studentId: string; scores: ScoreInput[] }>; problems: string[];
} {
	const byStudent = new Map<string, ScoreInput[]>();
	const problems: string[] = [];
	for (const e of edits) {
		const part = sheet.parts.find((p) => p.position === e.position);
		const row = sheet.students.find((r) => r.student.id === e.studentId);
		if (!part || !row) continue;
		const problem = e.absent ? null : scoreProblem(part, e.raw);
		if (problem) { problems.push(`${row.student.name}: ${problem}`); continue; }
		const saved = row.scores.find((s) => s.position === e.position);
		const newScore = e.absent || e.raw.trim() === "" ? null : Number(e.raw.trim());
		if ((saved?.score ?? null) === newScore && (saved?.absent ?? false) === e.absent) continue;
		const entry: ScoreInput = e.absent ? { position: e.position, absent: true } : newScore === null ? { position: e.position } : { position: e.position, score: newScore };
		byStudent.set(e.studentId, [...(byStudent.get(e.studentId) ?? []), entry]);
	}
	return { entries: [...byStudent].map(([studentId, scores]) => ({ studentId, scores })), problems };
}

/** Server limit per request. */
export const MAX_ENTRIES_PER_SAVE = 200;
export function chunkEntries<T>(entries: T[], size = MAX_ENTRIES_PER_SAVE): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < entries.length; i += size) out.push(entries.slice(i, i + size));
	return out;
}

export function skipText(s: SkippedEntry): string {
	const who = s.student?.name ?? "A student";
	const why: Record<ScoreSkipReason, string> = {
		duplicate_entry: "was listed twice",
		not_on_class_list: "is not on this class list",
		invalid_score: s.message ?? "has a score that is not valid",
	};
	return s.reason === "invalid_score" ? `${who}: ${why.invalid_score}` : `${who} ${why[s.reason]}`;
}

export function reopenReasonProblem(reason: string): string | null {
	const t = reason.trim();
	if (t.length < REOPEN_REASON_MIN) return `Please say why (at least ${REOPEN_REASON_MIN} characters)`;
	if (t.length > REOPEN_REASON_MAX) return `Keep it under ${REOPEN_REASON_MAX} characters`;
	return null;
}

/** Plain-words message for the grades error codes; null for anything else (the caller falls back to the server's message). */
export function gradesErrorText(code: string | undefined, details?: unknown): string | null {
	const d = (details ?? {}) as { status?: string; total?: number; problems?: string[] };
	switch (code) {
		case "GRADES_SHEET_NOT_EDITABLE": return `This sheet is ${d.status ?? "no longer a draft"}. Scores can only be changed while it is a draft. Reopen it first.`;
		case "GRADES_ILLEGAL_TRANSITION": return "That step is not allowed from the sheet's current status. Refresh and try again.";
		case "GRADES_SHEET_INCOMPLETE": return `${d.total ?? "Some"} student(s) still have scores missing. Enter every part, or mark the student absent.`;
		case "GRADES_SHEET_EMPTY": return "There are no students on the class list for this term, so there is nothing to submit.";
		case "GRADES_SCALE_INVALID": return ["This grading scale is not valid.", ...(d.problems ?? [])].join(" ");
		case "GRADES_SCHEME_INVALID": return ["This assessment scheme is not valid.", ...(d.problems ?? [])].join(" ");
		case "GRADES_DEFAULT_REQUIRED": return "The default cannot be removed. Change it instead.";
		default: return null;
	}
}
