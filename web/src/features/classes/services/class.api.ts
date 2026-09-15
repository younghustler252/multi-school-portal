import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	ClassResponseData,
	ClassProgressionResponseData,
	SetClassProgressionDto,
	SubjectResponseData,
	ClassSubjectResponseData,
	CreateClassDto,
	UpdateClassDto,
	CreateSubjectDto,
	AssignSubjectDto,
} from "../types/class.types";

export const classApi = {

	list: (termId?: string): Promise<ApiResponse<ClassResponseData[]>> =>
		API.get("/classes", { params: { termId } }),
	create: (data: CreateClassDto): Promise<ApiResponse<ClassResponseData>> =>
		API.post("/classes", data),

	update: (id: string, data: UpdateClassDto): Promise<ApiResponse<ClassResponseData>> =>
		API.put(`/classes/${id}`, data),

	delete: (id: string): Promise<ApiResponse<null>> =>
		API.delete(`/classes/${id}`),

	setClassTeacher: (classId: string, staffId: string | null): Promise<ApiResponse<ClassResponseData>> =>
		API.put(`/classes/${classId}/class-teacher`, { staffId }),

	getClassSubjects: (classId: string): Promise<ApiResponse<ClassSubjectResponseData[]>> =>
		API.get(`/classes/${classId}/subjects`),

	assignSubject: (classId: string, data: AssignSubjectDto): Promise<ApiResponse<ClassSubjectResponseData>> =>
		API.post(`/classes/${classId}/subjects`, data),

	removeSubject: (classId: string, classSubjectId: string): Promise<ApiResponse<null>> =>
		API.delete(`/classes/${classId}/subjects/${classSubjectId}`),

	listSubjects: (): Promise<ApiResponse<SubjectResponseData[]>> =>
		API.get("/classes/subjects/all"),

	createSubject: (data: CreateSubjectDto): Promise<ApiResponse<SubjectResponseData>> =>
		API.post("/classes/subjects", data),

	getById: (id: string): Promise<ApiResponse<ClassResponseData>> =>
		API.get(`/classes/${id}`),

	setProgression: (
		id: string,
		data: SetClassProgressionDto,
	): Promise<ApiResponse<ClassProgressionResponseData>> =>
		API.put(`/classes/${id}/progression`, data),
};