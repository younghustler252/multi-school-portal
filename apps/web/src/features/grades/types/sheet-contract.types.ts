/*
| Grades contract (backend refactor/api, apps/api/src/modules/grades). Read from the DTOs, use cases and presenter.
| These sit beside the old grade.types.ts, which describes removed routes; the old file goes when the screens move.
| Totals, grades and positions are computed by the server; the web never derives them.
*/
export type SheetStatus = "draft" | "submitted" | "approved" | "published" | "locked";
export type SheetAction = "submit" | "approve" | "publish" | "lock" | "reopen";
export type PartKind = "ca" | "exam";
export type GradeLevel = "default" | "primary" | "jss" | "ss";

export interface NameRef { id: string; name: string }
export interface StudentRef { id: string; name: string; admissionNumber: string | null }
export interface TermRef extends NameRef { session: NameRef | null }
export interface SubjectRef extends NameRef { code: string | null }

export interface SheetListItem {
	classSubjectId: string;
	status: SheetStatus;
	class: NameRef;
	subject: SubjectRef;
	teacher: NameRef;
	term: TermRef;
	/** Students on the class list. */
	students: number;
	/** Students with every part entered (or marked absent). */
	complete: number;
}

export interface SheetPart { position: number; name: string; kind: PartKind; maxScore: number }
export interface SheetScore { position: number; score: number | null; absent: boolean }
export interface SheetStudentRow {
	student: StudentRef;
	scores: SheetScore[];
	total: number | null;
	grade: string | null;
	remark: string | null;
	position: number | null;
}
export interface SheetHistory {
	submittedAt: string | null; approvedAt: string | null; publishedAt: string | null;
	lockedAt: string | null; reopenedAt: string | null; reopenReason: string | null;
}
/** Permission, scope and status already combined by the server: buttons come from here, never from role names. */
export interface SheetCan { enter: boolean; submit: boolean; approve: boolean; publish: boolean; lock: boolean; reopen: boolean }

export interface SheetDetail {
	/** null until the first score is saved. */
	id: string | null;
	classSubjectId: string;
	status: SheetStatus;
	class: NameRef;
	subject: SubjectRef;
	teacher: NameRef;
	term: TermRef;
	parts: SheetPart[];
	students: SheetStudentRow[];
	summary: { students: number; complete: number; incomplete: number };
	history: SheetHistory;
	can: SheetCan;
}

export interface ListSheetsParams { page?: number; limit?: number; termId?: string; classId?: string; subjectId?: string; status?: SheetStatus }

export interface ScoreInput { position: number; score?: number | null; absent?: boolean }
export interface SaveScoresDto { entries: Array<{ studentId: string; scores: ScoreInput[] }> }
export type ScoreSkipReason = "duplicate_entry" | "not_on_class_list" | "invalid_score";
export interface SkippedEntry { student: StudentRef | null; studentId: string; reason: ScoreSkipReason; message?: string }
export interface SaveScoresResult {
	status: SheetStatus;
	saved: number;
	unchanged: number;
	skipped: SkippedEntry[];
	summary: { students: number; complete: number };
}
export interface SheetTransitionResult { classSubjectId: string; status: SheetStatus }
export interface ReopenDto { reason: string }

/** One published result (GET /grades). OWN scope sees only published or locked rows. */
export interface GradeResult {
	id: string;
	student: StudentRef;
	class: NameRef;
	subject: SubjectRef;
	term: TermRef;
	status: SheetStatus;
	scores: Array<{ name: string; kind: PartKind; maxScore: number; score: number | null; absent: boolean }>;
	total: number | null;
	grade: string | null;
	remark: string | null;
	position: number | null;
	outOf: number | null;
}
export interface ListGradeResultsParams { page?: number; limit?: number; studentId?: string; classId?: string; subjectId?: string; termId?: string }

/* Scales and schemes (per level; a level without its own row uses the default). */
export interface ScaleBand { minScore: number; upTo: number | null; grade: string; remark: string; isPass: boolean }
export interface GradeScale { id: string; name: string; bands: ScaleBand[] }
export interface ScaleLevel { level: GradeLevel; usesDefault: boolean; scale: GradeScale | null }
export interface ScaleBandInput { minScore: number; grade: string; remark: string; isPass: boolean }
export interface SaveScaleDto { bands: ScaleBandInput[] }

export interface SchemeComponent { name: string; kind: PartKind; maxScore: number; position: number }
export interface GradeScheme { id: string; name: string; total: number; components: SchemeComponent[] }
export interface SchemeLevel { level: GradeLevel; usesDefault: boolean; scheme: GradeScheme | null }
export interface SchemeComponentInput { name: string; kind: PartKind; maxScore: number }
export interface SaveSchemeDto { components: SchemeComponentInput[] }
