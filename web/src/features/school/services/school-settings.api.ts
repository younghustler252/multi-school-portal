import { API } from "@/lib/api-client";
import { ApiResponse } from "@/types/api-response";
import {
  SchoolSettingsResponseData,
  UpdateSchoolSettingsDto,
  UploadFileResponseData,
} from "../types/school-settings.types";

export const schoolSettingsApi = {
	getSettings: (): Promise<ApiResponse<SchoolSettingsResponseData>> =>
		API.get("/schools/settings"),

	updateSettings: (
		data: UpdateSchoolSettingsDto
	): Promise<ApiResponse<SchoolSettingsResponseData>> =>
		API.put("/schools/settings", data),

	uploadStamp: (
		file: File
	): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("stamp", file);

		return API.post("/schools/settings/stamp", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
		});
	},

	uploadSignature: (
		file: File
	): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("signature", file);

		return API.post("/schools/settings/signature", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
		});
	},
};