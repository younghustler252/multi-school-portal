import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	AttendanceResponseData,
	AttendanceSummary,
	MarkAttendanceDto,
	BulkMarkAttendanceDto,
	UpdateAttendanceDto,
	ListAttendanceParams,
} from "../types/attendance.types";

export const attendanceApi = {

	list: (params: ListAttendanceParams): Promise<ApiResponse<AttendanceResponseData[]>> =>
		API.get("/attendance", {
			params: {
				page: params.page,
				limit: params.limit,
				studentId: params.studentId,
				termId: params.termId,
				classId: params.classId,
				date: params.date,
				status: params.status,
				startDate: params.startDate,
				endDate: params.endDate,
			},
		}),

	getSummary: (studentId: string, termId?: string): Promise<ApiResponse<AttendanceSummary>> =>
		API.get(`/attendance/summary/${studentId}`, { params: { termId } }),

	mark: (data: MarkAttendanceDto): Promise<ApiResponse<AttendanceResponseData>> =>
		API.post("/attendance", data),

	bulkMark: (data: BulkMarkAttendanceDto): Promise<ApiResponse<AttendanceResponseData[]>> =>
		API.post("/attendance/bulk", data),

	update: (id: string, data: UpdateAttendanceDto): Promise<ApiResponse<AttendanceResponseData>> =>
		API.put(`/attendance/${id}`, data),

	getMyAttendance: (params: { termId?: string; startDate?: string; endDate?: string }): Promise<ApiResponse<AttendanceResponseData[]>> =>
		API.get("/attendance/me", { params }),

};