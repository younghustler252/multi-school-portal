import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	EnrolmentResponseData,
	EnrolStudentDto,
	BulkEnrolDto,
	UpdateEnrolmentDto,
	ListEnrolmentsParams,
} from "../types/enrolment.types";

export const enrolmentApi = {

	list: (params: ListEnrolmentsParams): Promise<ApiResponse<EnrolmentResponseData[]>> =>
		API.get("/enrolments", {
			params: {
				page: params.page,
				limit: params.limit,
				classId: params.classId,
				termId: params.termId,
				studentId: params.studentId,
				status: params.status,
			},
		}),

	enrol: (data: EnrolStudentDto): Promise<ApiResponse<EnrolmentResponseData>> =>
		API.post("/enrolments", data),

	bulkEnrol: (data: BulkEnrolDto): Promise<ApiResponse<EnrolmentResponseData[]>> =>
		API.post("/enrolments/bulk", data),

	updateStatus: (id: string, data: UpdateEnrolmentDto): Promise<ApiResponse<EnrolmentResponseData>> =>
		API.put(`/enrolments/${id}`, data),

};