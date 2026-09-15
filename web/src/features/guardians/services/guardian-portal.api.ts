import { API } from "@/lib/api/api-client";
import { ApiResponse, PaginationMeta } from "@/types/api-response";
import { MyChildResponseData, MyChildrenParams, MyChildrenInvoicesParams } from "../types/guardian-portal.types";
import { GradeResponseData } from "@/features/grades/types/grade.types";
import { AttendanceResponseData } from "@/features/attendance/types/attendance.types";
import { EnrichedInvoice } from "@/features/fees/types/fee.types";

export interface PaginatedResponse<T> {
	data: T[];
	meta: PaginationMeta;
}

export const guardianPortalApi = {

	getMyChildren: (): Promise<ApiResponse<MyChildResponseData[]>> =>
		API.get("/guardians/me/children"),

	getMyChildrenGrades: (params: MyChildrenParams): Promise<ApiResponse<GradeResponseData[]>> =>
		API.get("/grades/my-children", { params }),

	getMyChildrenAttendance: (params: MyChildrenParams): Promise<ApiResponse<AttendanceResponseData[]>> =>
		API.get("/attendance/my-children", { params }),

	getMyChildrenInvoices: (params: MyChildrenInvoicesParams): Promise<ApiResponse<EnrichedInvoice[]>> =>
		API.get("/fees/invoices/my-children", { params }),

};