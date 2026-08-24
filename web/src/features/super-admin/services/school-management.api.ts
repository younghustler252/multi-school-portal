import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { SchoolDocumentResponseData } from "@/features/school/types/school-document.types";
import {
	AdminSchoolResponseData,
	ListSchoolsParams,
	RejectSchoolDto,
	SuspendSchoolDto,
	RejectDocumentDto,
} from "../types/school-management.types";

export const schoolManagementApi = {

	list: (params: ListSchoolsParams): Promise<ApiResponse<AdminSchoolResponseData[]>> =>
		API.get("/schools", { params }),

	getById: (id: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.get(`/schools/${id}`),

	verify: (id: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/schools/${id}/verify`),

	reject: (id: string, reason: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/schools/${id}/reject`, { schoolId: id, reason }),

	suspend: (id: string, reason: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/schools/${id}/suspend`, { schoolId: id, reason }),

	activate: (id: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/schools/${id}/activate`),

	approveDocument: (documentId: string): Promise<ApiResponse<SchoolDocumentResponseData>> =>
		API.put(`/schools/documents/${documentId}/approve`),

	rejectDocument: (documentId: string, reason: string): Promise<ApiResponse<SchoolDocumentResponseData>> =>
		API.put(`/schools/documents/${documentId}/reject`, { documentId, reason }),

};