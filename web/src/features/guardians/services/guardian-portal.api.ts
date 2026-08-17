import { API } from "@/lib/api/api-client";
import { ApiResponse, PaginationMeta } from "@/types/api-response";
import { MyChildResponseData, MyChildrenParams, MyChildrenInvoicesParams } from "../types/guardian-portal.types";
import { GradeResponseData } from "@/features/grades/types/grade.types";
import { AttendanceResponseData } from "@/features/attendance/types/attendance.types";
import { FeeInvoiceResponseData } from "@/features/fees/types/fee.types";

export interface PaginatedResponse<T> {
	data: T[];
	meta: PaginationMeta;
}

export const guardianPortalApi = {

	// "my children" list itself still lives on the guardian module —
	// confirmed via GetMyChildrenUseCase, which reads from guardianRepository directly
	getMyChildren: (): Promise<ApiResponse<MyChildResponseData[]>> =>
		API.get("/guardians/me/children"),

	getMyChildrenGrades: (params: MyChildrenParams): Promise<ApiResponse<GradeResponseData[]>> =>
		API.get("/grades/my-children", { params }),

	getMyChildrenAttendance: (params: MyChildrenParams): Promise<ApiResponse<AttendanceResponseData[]>> =>
		API.get("/attendance/my-children", { params }),

	getMyChildrenInvoices: (params: MyChildrenInvoicesParams): Promise<ApiResponse<FeeInvoiceResponseData[]>> =>
		API.get("/fees/invoices/my-children", { params }),

};