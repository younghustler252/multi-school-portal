import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	GuardianResponseData,
	CreateGuardianDto,
	UpdateGuardianDto,
	LinkGuardianDto,
	ListGuardiansParams,
	GuardianWithStudentsResponseData,
	BulkInviteGuardiansResult,
} from "../types/guardian.types";

export const guardianApi = {

	list: (params: ListGuardiansParams): Promise<ApiResponse<GuardianResponseData[]>> =>
		API.get("/guardians", {
			params: {
				page: params.page,
				limit: params.limit,
				studentId: params.studentId,
				search: params.search,
			},
		}),

	getById: (id: string): Promise<ApiResponse<GuardianWithStudentsResponseData>> =>
		API.get(`/guardians/${id}`),

	create: (data: CreateGuardianDto): Promise<ApiResponse<GuardianResponseData>> =>
		API.post("/guardians", data),

	update: (id: string, data: UpdateGuardianDto): Promise<ApiResponse<GuardianResponseData>> =>
		API.put(`/guardians/${id}`, data),

	invite: (id: string): Promise<ApiResponse<null>> =>
		API.post(`/guardians/${id}/invite`),

	link: (id: string, data: LinkGuardianDto): Promise<ApiResponse<null>> =>
		API.post(`/guardians/${id}/link`, data),

	bulkInvite: (guardianIds: string[]): Promise<ApiResponse<BulkInviteGuardiansResult>> =>
		API.post("/guardians/invite/bulk", { guardianIds }),
};