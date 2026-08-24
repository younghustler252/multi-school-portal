export type ReportCardStatus = "draft" | "generated" | "published" | "sent";
export type ReportCardTemplate = "classic" | "modern" | "minimal" | "custom_letterhead";

export interface ReportCardResponseData {
	id: string;
	studentId: string;
	termId: string;
	status: ReportCardStatus;
	teacherRemark: string | null;
	principalRemark: string | null;
	totalScore: number | null;
	averageScore: number | null;
	position: number | null;
	totalStudents: number | null;
	pdfUrl: string | null; // short-lived signed URL (~5 min) — refetch before use, never cache
	emailSentAt: string | null;
	smsSentAt: string | null;
	generatedAt: string | null;
	createdAt: string;
}

export interface GenerateReportCardDto {
	studentId: string;
	termId: string;
	teacherRemark?: string;
	principalRemark?: string;
}

export interface BulkGenerateReportCardDto {
	termId: string;
	classId?: string;
	principalRemark?: string;
}

export interface UpdateReportCardDto {
	teacherRemark?: string;
	principalRemark?: string;
}

export interface ListReportCardsParams {
	page?: number;
	limit?: number;
	termId?: string;
	studentId?: string;
	status?: ReportCardStatus;
}

export interface PublishReportCardsDto {
	termId: string;
	classId?: string;
}

export interface BulkGenerateJobResult {
	total: number;
	generated: number;
	skipped: number;
	failed: number;
	results: Array<{ studentId: string; status: "generated" | "skipped" | "failed"; reason?: string }>;
}

export interface BulkGenerateJobStatus {
	jobId: string;
	state: "waiting" | "active" | "completed" | "failed";
	progress: number;
	result: BulkGenerateJobResult | null;
}