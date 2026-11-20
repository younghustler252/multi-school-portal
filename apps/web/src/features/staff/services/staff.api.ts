import { API, apiCall } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import type {
	AssignableBranch, AssignableStaffRole, CreateStaffDto, CreateStaffResult, DeactivateStaffDto, DeactivateStaffResult, ListStaffParams, MyClassesResponse,
	SetStaffBranchesDto, StaffAssignmentResponseData, StaffBranchesResult, StaffResponseData, StaffRolesResult, UpdateStaffDto,
} from "../types/staff.types";

/*
| Staff API (docs/backend/modules/staff.md). The list keeps the response envelope because it needs `meta` for paging.
| Everything else goes through apiCall, which throws ApiError (with `code` and `details`) so callers can react to codes
| such as POSSIBLE_DUPLICATE_STAFF or STAFF_HAS_ASSIGNMENTS.
*/
export const staffApi = {
	list: (params: ListStaffParams): Promise<ApiResponse<StaffResponseData[]>> => API.get("/staff", { params }),

	getById: (id: string): Promise<StaffResponseData> => apiCall<StaffResponseData>({ method: "GET", url: `/staff/${id}` }),

	create: (data: CreateStaffDto): Promise<CreateStaffResult> => apiCall<CreateStaffResult>({ method: "POST", url: "/staff", data }),

	update: (id: string, data: UpdateStaffDto): Promise<StaffResponseData> => apiCall<StaffResponseData>({ method: "PUT", url: `/staff/${id}`, data }),

	deactivate: (id: string, data: DeactivateStaffDto = {}): Promise<DeactivateStaffResult> =>
		apiCall<DeactivateStaffResult>({ method: "POST", url: `/staff/${id}/deactivate`, data }),

	reactivate: (id: string): Promise<StaffResponseData> => apiCall<StaffResponseData>({ method: "POST", url: `/staff/${id}/reactivate` }),

	setBranches: (id: string, data: SetStaffBranchesDto): Promise<StaffBranchesResult> =>
		apiCall<StaffBranchesResult>({ method: "PUT", url: `/staff/${id}/branches`, data }),

	changeRoles: (id: string, roleIds: string[]): Promise<StaffRolesResult> =>
		apiCall<StaffRolesResult>({ method: "PUT", url: `/staff/${id}/roles`, data: { roleIds } }),

	invite: (id: string, roleId: string): Promise<{ message: string; inviteId: string; expiresAt: string }> =>
		apiCall({ method: "POST", url: `/staff/${id}/invite`, data: { roleId } }),

	/** The roles the signed-in person may grant (invite and change-roles pickers). Needs staff.manage, not roles.view. */
	assignableRoles: (): Promise<AssignableStaffRole[]> => apiCall<AssignableStaffRole[]>({ method: "GET", url: "/staff/assignable-roles" }),

	/** The active branches the signed-in person may place staff in. Needs staff.manage, not branches.view. */
	assignableBranches: (): Promise<AssignableBranch[]> => apiCall<AssignableBranch[]>({ method: "GET", url: "/staff/assignable-branches" }),

	getAssignments: (id: string): Promise<ApiResponse<StaffAssignmentResponseData[]>> => API.get(`/staff/${id}/assignments`),

	getMyClasses: (): Promise<ApiResponse<MyClassesResponse>> => API.get("/staff/me/classes"),
};
