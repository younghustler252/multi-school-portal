import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	SchoolSettingsResponseData,
	UpdateSchoolSettingsDto,
	UploadFileResponseData,
	
} from "../types/school-settings.types";

export const schoolSettingsApi = {
	getSettings: (): Promise<ApiResponse<SchoolSettingsResponseData>> =>
		API.get("/school-settings"),

	updateSettings: (
		data: UpdateSchoolSettingsDto,
	): Promise<ApiResponse<SchoolSettingsResponseData>> =>
		API.put("/school-settings", data),

	uploadStamp: (
		file: File,
	): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("stamp", file);

		return API.post("/school-settings/stamp", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});
	},

	uploadSignature: (
		file: File,
	): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("signature", file);

		return API.post("/school-settings/signature", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});
	},

	uploadLetterhead: (file: File): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("letterhead", file);
		return API.post("/school/settings/letterhead", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});
	},
};