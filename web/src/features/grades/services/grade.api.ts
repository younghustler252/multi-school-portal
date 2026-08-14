import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	GradeResponseData,
	EnterGradeDto,
	BulkEnterGradesDto,
	UpdateGradeDto,
	PublishGradesDto,
	ListGradesParams,
	GradingConfigRow,
	UpdateGradingConfigDto,
} from "../types/grade.types";

export const gradeApi = {

	list: (params: ListGradesParams): Promise<ApiResponse<GradeResponseData[]>> =>
		API.get("/grades", {
			params: {
				page: params.page,
				limit: params.limit,
				studentId: params.studentId,
				termId: params.termId,
				classSubjectId: params.classSubjectId,
				isPublished: params.isPublished,
			},
		}),

	enter: (data: EnterGradeDto): Promise<ApiResponse<GradeResponseData>> =>
		API.post("/grades", data),

	bulkEnter: (data: BulkEnterGradesDto): Promise<ApiResponse<GradeResponseData[]>> =>
		API.post("/grades/bulk", data),

	update: (id: string, data: UpdateGradeDto): Promise<ApiResponse<GradeResponseData>> =>
		API.put(`/grades/${id}`, data),

	publish: (data: PublishGradesDto): Promise<ApiResponse<null>> =>
		API.post("/grades/publish", data),

	getConfig: (): Promise<ApiResponse<GradingConfigRow[]>> =>
		API.get("/grades/config"),

	updateConfig: (data: UpdateGradingConfigDto): Promise<ApiResponse<GradingConfigRow[]>> =>
		API.put("/grades/config", data),

};