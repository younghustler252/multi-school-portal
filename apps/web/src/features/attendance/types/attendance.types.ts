export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceResponseData {
	id: string;
	studentId: string;
	termId: string;
	date: string;
	status: AttendanceStatus;
	note: string | null;
	createdAt: string;
}

export interface AttendanceSummary {
	studentId: string;
	termId: string;
	total: number;
	present: number;
	absent: number;
	late: number;
	excused: number;
	percentage: number;
}

export interface MarkAttendanceDto {
	studentId: string;
	termId: string;
	date: string;
	status: AttendanceStatus;
	note?: string;
}

export interface BulkAttendanceRecord {
	studentId: string;
	status: AttendanceStatus;
	note?: string;
}

export interface BulkMarkAttendanceDto {
	termId: string;
	date: string;
	records: BulkAttendanceRecord[];
}

export interface UpdateAttendanceDto {
	status: AttendanceStatus;
	note?: string;
}

export interface ListAttendanceParams {
	page?: number;
	limit?: number;
	studentId?: string;
	termId?: string;
	classId?: string;
	date?: string;
	status?: AttendanceStatus;
	startDate?: string;
	endDate?: string;
}