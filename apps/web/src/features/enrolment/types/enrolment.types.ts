export type EnrolmentStatus = "active" | "withdrawn" | "transferred" | "completed";

export interface EnrolmentResponseData {
	id: string;
	studentId: string;
	classId: string;
	termId: string;
	status: EnrolmentStatus;
	createdAt: string;
}

export interface EnrolStudentDto {
	studentId: string;
	classId: string;
	termId: string;
}

export interface BulkEnrolDto {
	studentIds: string[];
	classId: string;
	termId: string;
}

export interface UpdateEnrolmentDto {
	status: EnrolmentStatus;
}

export interface ListEnrolmentsParams {
	page?: number;
	limit?: number;
	classId?: string;
	termId?: string;
	studentId?: string;
	status?: EnrolmentStatus;
}