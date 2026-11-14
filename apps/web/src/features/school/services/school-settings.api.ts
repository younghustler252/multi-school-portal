import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { uploadedUrl } from "@/lib/api/upload-result";
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

	/** The API returns the updated school settings; `stamp` holds the new address. */
	uploadStamp: async (
		file: File,
	): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("stamp", file);

		return uploadedUrl(
			await API.post<SchoolSettingsResponseData>("/school-settings/stamp", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			}),
			(s) => s.stamp,
		);
	},

	/** As above; `signature` holds the new address. */
	uploadSignature: async (
		file: File,
	): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("signature", file);

		return uploadedUrl(
			await API.post<SchoolSettingsResponseData>("/school-settings/signature", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			}),
			(s) => s.signature,
		);
	},

	uploadLetterhead: (file: File): Promise<ApiResponse<UploadFileResponseData>> => {
		const formData = new FormData();
		formData.append("letterhead", file);
		return API.post("/school/settings/letterhead", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});
	},
};