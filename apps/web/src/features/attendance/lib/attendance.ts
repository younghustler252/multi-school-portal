import type { AttendanceStatus, ClassRegister, RegisterEntry, SkipReason, SubmitRegisterResult } from "../types/attendance.types";

/*
| Rules around the class register (docs/backend/modules/attendance.md). Pure, so they are tested without a screen.
*/

/** Today's calendar day in the school's time zone. The backend uses Africa/Lagos for "today" (a Nigeria-only v1 rule). */
export function todayInLagos(now: Date = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type RegisterDraft = Record<string, { status?: AttendanceStatus; note?: string }>;

/** Mark every line that can still be changed and has no mark yet as present. Existing marks are never overwritten. */
export function presentForUnmarked(register: ClassRegister, draft: RegisterDraft): RegisterDraft {
	const next: RegisterDraft = { ...draft };
	for (const row of register.students) {
		if (row.editable && row.status === null && !next[row.student.id]?.status) next[row.student.id] = { ...next[row.student.id], status: "present" };
	}
	return next;
}

/** The status shown for a line: what the teacher chose, else what is saved, else nothing. */
export function statusShown(row: ClassRegister["students"][number], draft: RegisterDraft): AttendanceStatus | null {
	return draft[row.student.id]?.status ?? row.status;
}

/**
 * Entries to send: only lines the viewer may change, where the teacher chose a status or changed a note, and the result
 * differs from what is saved. A note alone needs a status, so a saved status is reused.
 */
export function entriesToSend(register: ClassRegister, draft: RegisterDraft): RegisterEntry[] {
	const out: RegisterEntry[] = [];
	for (const row of register.students) {
		if (!row.editable) continue;
		const d = draft[row.student.id];
		if (!d) continue;
		const status = d.status ?? row.status;
		if (!status) continue;
		const noteChanged = d.note !== undefined && d.note.trim() !== (row.note ?? "");
		if (status === row.status && !noteChanged) continue;
		const note = d.note !== undefined ? d.note.trim() : undefined;
		out.push({ studentId: row.student.id, status, ...(note !== undefined ? { note: note === "" ? null : note } : {}) });
	}
	return out;
}

/** Why the register can't be taken right now, or null when it can. */
export function registerClosedReason(register: ClassRegister, today: string): string | null {
	if (register.canMark) return null;
	if (register.holiday) return `${register.holiday} is a holiday, so no register is taken.`;
	if (register.date > today) return "This day hasn't come yet. A register can't be taken for a future date.";
	return "You can view this register but not take it.";
}

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
	duplicate_entry: "listed twice",
	not_on_class_list: "not on this class's list",
	edit_window_closed: "more than 48 hours old, and only someone with override access can change it",
};

/** One line saying what a saved register did. */
export function submitSummary(r: SubmitRegisterResult): string {
	const parts: string[] = [];
	if (r.created) parts.push(`${r.created} marked`);
	if (r.updated) parts.push(`${r.updated} corrected`);
	if (r.unchanged) parts.push(`${r.unchanged} unchanged`);
	return parts.length ? parts.join(", ") : "Nothing to change";
}

export function formatRate(rate: number | null): string {
	return rate === null ? "—" : `${rate}%`;
}

/** Messages for the domain codes the attendance routes answer with. */
export function attendanceErrorMessage(code: string | undefined, fallback: string): string {
	switch (code) {
		case "ATTENDANCE_DATE_IN_FUTURE": return "You can't take attendance for a future date.";
		case "ATTENDANCE_OUTSIDE_TERM": return "That date is outside every term. Pick a school day.";
		case "ATTENDANCE_TERM_AMBIGUOUS": return "That date falls in more than one term. Ask an administrator to fix the academic calendar.";
		case "ATTENDANCE_HOLIDAY": return "That day is a holiday, so no register is taken.";
		case "ATTENDANCE_EDIT_WINDOW_CLOSED": return "This mark is more than 48 hours old. Only someone with override access can change it.";
		case "ATTENDANCE_NOTHING_TO_CHANGE": return "Nothing was changed.";
		default: return fallback;
	}
}
