import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	ReportCardResponseData,
	GenerateReportCardDto,
	BulkGenerateReportCardDto,
	UpdateReportCardDto,
	ListReportCardsParams,
	PublishReportCardsDto,
	BulkGenerateJobStatus,
	ReportCardDetailResponseData,
} from "../types/report-card.types";

export const reportCardApi = {

	list: (params: ListReportCardsParams): Promise<ApiResponse<ReportCardResponseData[]>> =>
		API.get("/report-cards", { params }),

	getById: (id: string): Promise<ApiResponse<ReportCardDetailResponseData>> =>
		API.get(`/report-cards/${id}`),

	generate: (data: GenerateReportCardDto): Promise<ApiResponse<ReportCardResponseData>> =>
		API.post("/report-cards", data),

	bulkGenerate: (data: BulkGenerateReportCardDto): Promise<ApiResponse<{ message: string; jobId: string }>> =>
		API.post("/report-cards/bulk", data),

	getBulkStatus: (jobId: string): Promise<ApiResponse<BulkGenerateJobStatus>> =>
		API.get(`/report-cards/bulk-status/${jobId}`),

	update: (id: string, data: UpdateReportCardDto): Promise<ApiResponse<ReportCardResponseData>> =>
		API.put(`/report-cards/${id}`, data),

	publish: (data: PublishReportCardsDto): Promise<ApiResponse<null>> =>
		API.post("/report-cards/publish", data),

	send: (id: string): Promise<ApiResponse<null>> =>
		API.post(`/report-cards/${id}/send`),

	// Self-service — per handoff doc
	getMine: (params: { termId?: string }): Promise<ApiResponse<ReportCardResponseData[]>> =>
		API.get("/report-cards/me", { params }),

	getMyChildren: (params: { studentId?: string; termId?: string }): Promise<ApiResponse<ReportCardResponseData[]>> =>
		API.get("/report-cards/my-children", { params }),

};