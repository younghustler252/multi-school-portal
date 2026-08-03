import { API } from "@/lib/api/api-client";
import { ApiResponse, PaginationMeta } from "@/types/api-response";
import {
	StudentResponseData,
	CreateStudentDto,
	UpdateStudentDto,
	ListStudentsParams,
	UploadPhotoResponseData,
} from "../types/student.types";

export interface ListStudentsResult {
	students: StudentResponseData[];
	meta: PaginationMeta;
}

export const studentApi = {

	list: (params: ListStudentsParams): Promise<ApiResponse<StudentResponseData[]>> =>
		API.get("/students", {
			params: {
				page: params.page,
				limit: params.limit,
				gender: params.gender,
				isActive: params.isActive,
				search: params.search,
			},
		}),

	getById: (id: string): Promise<ApiResponse<StudentResponseData>> =>
		API.get(`/students/${id}`),

	create: (data: CreateStudentDto): Promise<ApiResponse<StudentResponseData>> =>
		API.post("/students", data),

	update: (id: string, data: UpdateStudentDto): Promise<ApiResponse<StudentResponseData>> =>
		API.put(`/students/${id}`, data),

	deactivate: (id: string): Promise<ApiResponse<null>> =>
		API.delete(`/students/${id}`),

	uploadPhoto: (id: string, file: File): Promise<ApiResponse<UploadPhotoResponseData>> => {
		const formData = new FormData();
		formData.append("photo", file);
		return API.post(`/students/${id}/photo`, formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});
	},

};