import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { StaffResponseData, CreateStaffDto, UpdateStaffDto, ListStaffParams, StaffAssignmentResponseData, MyClassResponseData } from "../types/staff.types";

export const staffApi = {

	list: (params: ListStaffParams): Promise<ApiResponse<StaffResponseData[]>> =>
		API.get("/staff", {
			params: {
				page: params.page,
				limit: params.limit,
				role: params.role,
				department: params.department,
				search: params.search,
				isActive: params.isActive,
			},
		}),

	getById: (id: string): Promise<ApiResponse<StaffResponseData>> =>
		API.get(`/staff/${id}`),

	create: (data: CreateStaffDto): Promise<ApiResponse<StaffResponseData>> =>
		API.post("/staff", data),

	update: (id: string, data: UpdateStaffDto): Promise<ApiResponse<StaffResponseData>> =>
		API.put(`/staff/${id}`, data),

	deactivate: (id: string): Promise<ApiResponse<null>> =>
		API.delete(`/staff/${id}`),

	reactivate: (id: string): Promise<ApiResponse<StaffResponseData>> =>
		API.put(`/staff/${id}/reactivate`),

	getAssignments: (id: string): Promise<ApiResponse<StaffAssignmentResponseData[]>> =>
		API.get(`/staff/${id}/assignments`),

	getMyClasses: (): Promise<ApiResponse<MyClassResponseData[]>> =>
		API.get("/staff/me/classes"),
};