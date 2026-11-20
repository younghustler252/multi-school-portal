/*
| Shapes of docs/backend/modules/attendance.md (sections 2, 5, 6, 7). Dates are calendar days "YYYY-MM-DD" and are never
| converted to a time. A class register is per class and day; the server finds the term from the date, so no termId is sent.
*/
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface NameRef { id: string; name: string }
export interface StudentRef { id: string; name: string; admissionNumber: string | null }
export interface TermRef extends NameRef { session: NameRef | null }

/** One mark, as GET /attendance and PUT /attendance/:id return it. Related records are null for old rows. */
export interface AttendanceMark {
	id: string;
	date: string;
	status: AttendanceStatus;
	note: string | null;
	student: StudentRef | null;
	class: NameRef | null;
	term: TermRef | null;
	markedBy: NameRef | null;
	markedAt: string;
	updatedAt: string;
}

export interface RegisterRow {
	student: StudentRef;
	/** null until the student has been marked that day. */
	id: string | null;
	status: AttendanceStatus | null;
	note: string | null;
	markedBy: NameRef | null;
	markedAt: string | null;
	/** The viewer can change this line now (inside the 48-hour window, or they may override). */
	editable: boolean;
}

/** GET /attendance/classes/:classId/register?date= */
export interface ClassRegister {
	class: NameRef;
	date: string;
	term: TermRef;
	/** Title of the holiday that closes the register, or null. */
	holiday: string | null;
	canMark: boolean;
	students: RegisterRow[];
	summary: { present: number; absent: number; late: number; excused: number; unmarked: number };
}

export interface RegisterEntry {
	studentId: string;
	status: AttendanceStatus;
	note?: string | null;
}

/** POST /attendance/classes/:classId. 1 to 200 entries. */
export interface SubmitRegisterDto {
	date: string;
	entries: RegisterEntry[];
}

export type SkipReason = "duplicate_entry" | "not_on_class_list" | "edit_window_closed";

export interface SubmitRegisterResult {
	class: NameRef;
	date: string;
	term: TermRef;
	created: number;
	updated: number;
	unchanged: number;
	skipped: Array<{ student: StudentRef | null; studentId: string; reason: SkipReason }>;
	unmarked: number;
}

/** PUT /attendance/:id. At least one field. An empty note clears it. */
export interface UpdateAttendanceDto {
	status?: AttendanceStatus;
	note?: string | null;
}

/** The counts behind both summaries. Excused is shown but not in the rate. */
export interface AttendanceCounts {
	present: number;
	late: number;
	absent: number;
	excused: number;
	/** present + late + absent + excused */
	daysMarked: number;
	/** present + late */
	timesPresent: number;
	/** (present + late) / (present + late + absent) as a percent, one decimal; null when nothing counted. */
	rate: number | null;
	/** rate below 75 */
	lowAttendance: boolean;
}

/** GET /attendance/summary?studentId&termId (term defaults to the current one). */
export interface StudentAttendanceSummary extends AttendanceCounts {
	student: StudentRef;
	term: TermRef;
	class: NameRef | null;
	/** Days a register was taken for the class this term. */
	registerDays: number;
	/** Register days with no mark for this student. */
	unmarked: number;
}

/** GET /attendance/classes/:classId/summary?termId */
export interface ClassAttendanceSummary {
	class: NameRef;
	term: TermRef;
	registerDays: number;
	classSummary: AttendanceCounts;
	students: Array<AttendanceCounts & { student: StudentRef; registerDays: number; unmarked: number }>;
}

/** GET /attendance. Filters narrow the viewer's own scope; they can't widen it. */
export interface ListAttendanceParams {
	page?: number;
	limit?: number;
	studentId?: string;
	classId?: string;
	termId?: string;
	from?: string;
	to?: string;
	status?: AttendanceStatus;
}
