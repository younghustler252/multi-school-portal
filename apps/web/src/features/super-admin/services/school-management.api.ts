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
import { EnrichedAuditLog, ListActivityParams } from "../types/audit-log.types";
import { PlatformUserResponseData } from "../types/super-admin.types";
import { CreateSchoolFormValues } from "../schemas/create-school.schema";

export const schoolManagementApi = {
	create: (data: CreateSchoolFormValues): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.post("/platform/schools", data),

	list: (params: ListSchoolsParams): Promise<ApiResponse<AdminSchoolResponseData[]>> =>
		API.get("/platform/schools", { params }),

	getById: (id: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.get(`/platform/schools/${id}`),

	verify: (id: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/platform/schools/${id}/verify`),

	reject: (id: string, reason: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/platform/schools/${id}/reject`, { reason }),

	suspend: (id: string, reason: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/platform/schools/${id}/suspend`, { reason }),

	activate: (id: string): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/platform/schools/${id}/reactivate`),

	getSchoolDocuments: (schoolId: string): Promise<ApiResponse<SchoolDocumentResponseData[]>> =>
		API.get(`/platform/schools/${schoolId}/documents`),

	approveDocument: (documentId: string): Promise<ApiResponse<SchoolDocumentResponseData>> =>
		API.put(`/platform/schools/documents/${documentId}/approve`),

	rejectDocument: (documentId: string, reason: string): Promise<ApiResponse<SchoolDocumentResponseData>> =>
		API.put(`/platform/schools/documents/${documentId}/reject`, { reason }),

	impersonateSchool: (schoolId: string): Promise<ApiResponse<{ accessToken: string; school: AdminSchoolResponseData; admin: PlatformUserResponseData }>> =>
		API.post(`/super-admin/schools/${schoolId}/impersonate`),

	getActivity: (
		schoolId: string,
		params: ListActivityParams,
	): Promise<ApiResponse<EnrichedAuditLog[]>> =>
		API.get(`/super-admin/schools/${schoolId}/activity`, { params }),

	resetAdminPassword: (
		schoolId: string,
	): Promise<ApiResponse<{ message: string }>> =>
		API.post(`/super-admin/schools/${schoolId}/reset-admin-password`),
};