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
		API.post("/schools", data),

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
		API.put(`/schools/${id}/approve`),

	getSchoolDocuments: (schoolId: string): Promise<ApiResponse<SchoolDocumentResponseData[]>> =>
		API.get(`/schools/${schoolId}/documents`),

	approveDocument: (documentId: string): Promise<ApiResponse<SchoolDocumentResponseData>> =>
		API.put(`/schools/documents/${documentId}/approve`),

	rejectDocument: (documentId: string, reason: string): Promise<ApiResponse<SchoolDocumentResponseData>> =>
		API.put(`/schools/documents/${documentId}/reject`, { documentId, reason }),

	impersonateSchool: (schoolId: string): Promise<ApiResponse<{ accessToken: string; school: AdminSchoolResponseData; admin: PlatformUserResponseData }>> =>
		API.post(`/super-admin/schools/${schoolId}/impersonate`),

	getActivity: (
		schoolId: string,
		params: ListActivityParams,
	): Promise<ApiResponse<EnrichedAuditLog[]>> =>
		API.get(`/super-admin/schools/${schoolId}/activity`, { params }),

	changePlan: (
		schoolId: string,
		planId: string,
	): Promise<ApiResponse<AdminSchoolResponseData>> =>
		API.put(`/super-admin/schools/${schoolId}/plan`, { planId }),


	resetAdminPassword: (
		schoolId: string,
	): Promise<ApiResponse<{ message: string }>> =>
		API.post(`/super-admin/schools/${schoolId}/reset-admin-password`),
};