import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	SessionResponseData,
	TermResponseData,
	CreateSessionDto,
	CreateTermDto,
	UpdateTermDto,
	CurrentSessionResponseData,
} from "../types/session.types";

export const sessionApi = {

	list: (): Promise<ApiResponse<SessionResponseData[]>> =>
		API.get("/sessions"),

	getCurrent: (): Promise<ApiResponse<CurrentSessionResponseData>> =>
		API.get("/sessions/current"),

	create: (data: CreateSessionDto): Promise<ApiResponse<SessionResponseData>> =>
		API.post("/sessions", data),

	setCurrent: (id: string): Promise<ApiResponse<SessionResponseData>> =>
		API.put(`/sessions/${id}/set-current`),

	createTerm: (data: CreateTermDto): Promise<ApiResponse<TermResponseData>> =>
		API.post("/sessions/terms", data),

	updateTerm: (termId: string, data: UpdateTermDto): Promise<ApiResponse<TermResponseData>> =>
		API.put(`/sessions/terms/${termId}`, data),

	setCurrentTerm: (termId: string): Promise<ApiResponse<TermResponseData>> =>
		API.put(`/sessions/terms/${termId}/set-current`),

};