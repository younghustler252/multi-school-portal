import { API } from "@/lib/api/api-client";
import { ApiResponse, PaginationMeta } from "@/types/api-response";
import {
	StudentResponseData,
	StudentListResponseData,
	CreateStudentDto,
	UpdateStudentDto,
	ListStudentsParams,
	UploadPhotoResponseData,
	StudentWithGuardiansResponseData,
	ImportStudentsResult
} from "../types/student.types";

export interface ListStudentsResult {
	students: StudentResponseData[];
	meta: PaginationMeta;
}

export const studentApi = {

	list: (params: ListStudentsParams): Promise<ApiResponse<StudentListResponseData[]>> =>
	API.get("/students", { params }),

	getById: (id: string): Promise<ApiResponse<StudentWithGuardiansResponseData>> =>
		API.get(`/students/${id}`),

	getMe: (): Promise<ApiResponse<StudentWithGuardiansResponseData>> =>
		API.get("/students/me"),

	create: (data: CreateStudentDto): Promise<ApiResponse<StudentResponseData>> =>
		API.post("/students", data),

	batch: (ids: string[]): Promise<ApiResponse<StudentResponseData[]>> =>
		API.post("/students/batch", { ids }),

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

	import: (file: File): Promise<ApiResponse<ImportStudentsResult>> => {
		const formData = new FormData();
		formData.append("file", file);
		return API.post("/students/import", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});
	},

};