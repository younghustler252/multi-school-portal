import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	ClassResponseData,
	ClassProgressionResponseData,
	SetClassProgressionDto,
	SubjectResponseData,
	ClassSubjectResponseData,
	EnrichedClassSubject,
	CreateClassDto,
	UpdateClassDto,
	CreateSubjectDto,
	AssignSubjectDto,
	BulkAssignSubjectsDto,
	ApplyTeachingDefaultsDto,
	ApplyTeachingDefaultsResult,
} from "../types/class.types";

export const classApi = {
	list: (termId?: string): Promise<ApiResponse<ClassResponseData[]>> =>
		API.get("/classes", { params: { termId } }),

	create: (
		data: CreateClassDto,
	): Promise<ApiResponse<ClassResponseData>> =>
		API.post("/classes", data),

	update: (
		id: string,
		data: UpdateClassDto,
	): Promise<ApiResponse<ClassResponseData>> =>
		API.put(`/classes/${id}`, data),

	delete: (id: string): Promise<ApiResponse<null>> =>
		API.delete(`/classes/${id}`),

	setClassTeacher: (
		classId: string,
		staffId: string | null,
	): Promise<ApiResponse<ClassResponseData>> =>
		API.put(`/classes/${classId}/class-teacher`, { staffId }),

	getClassSubjects: (
		classId: string,
		termId: string,
	): Promise<ApiResponse<EnrichedClassSubject[]>> =>
		API.get(`/classes/${classId}/subjects`, {
			params: { termId },
		}),

	assignSubject: (
		classId: string,
		data: AssignSubjectDto,
	): Promise<ApiResponse<ClassSubjectResponseData>> =>
		API.post(`/classes/${classId}/subjects`, data),

	clearSubjectOverride: (
		classId: string,
		classSubjectId: string,
	): Promise<ApiResponse<ClassSubjectResponseData>> =>
		API.patch(
			`/classes/${classId}/subjects/${classSubjectId}/clear-override`,
		),

	removeSubject: (
		classId: string,
		classSubjectId: string,
	): Promise<ApiResponse<null>> =>
		API.delete(`/classes/${classId}/subjects/${classSubjectId}`),

	listSubjects: (): Promise<ApiResponse<SubjectResponseData[]>> =>
		API.get("/classes/subjects/all"),

	createSubject: (
		data: CreateSubjectDto,
	): Promise<ApiResponse<SubjectResponseData>> =>
		API.post("/classes/subjects", data),

	getById: (id: string): Promise<ApiResponse<ClassResponseData>> =>
		API.get(`/classes/${id}`),

	setProgression: (
		id: string,
		data: SetClassProgressionDto,
	): Promise<ApiResponse<ClassProgressionResponseData>> =>
		API.put(`/classes/${id}/progression`, data),

	bulkAssignSubjects: (
		classId: string,
		data: BulkAssignSubjectsDto,
	): Promise<ApiResponse<null>> =>
		API.post(`/classes/${classId}/subjects/bulk-assign`, data),

	applyTeachingDefaults: (): Promise<ApiResponse<ApplyTeachingDefaultsResult>> =>
		API.post("/classes/apply-teaching-defaults"),

	setSubjectDefaultTeacher: (
		subjectId: string, staffId: string | null,
	): Promise<ApiResponse<SubjectResponseData>> =>
		API.put(`/classes/subjects/${subjectId}/default-teacher`, { staffId }),
};
