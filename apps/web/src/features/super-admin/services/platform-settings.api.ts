import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { PlatformSettingsResponseData, UpdatePlatformSettingsDto } from "../types/platform-settings.types";

export const platformSettingsApi = {
	get: (): Promise<ApiResponse<PlatformSettingsResponseData>> =>
		API.get("/platform/settings"),

	update: (data: UpdatePlatformSettingsDto): Promise<ApiResponse<PlatformSettingsResponseData>> =>
		API.put("/platform/settings", data),

	/** JPEG, PNG or WebP, up to 2 MB. The API checks the file itself; this is only what the browser sends. */
	uploadLogo: (file: File): Promise<ApiResponse<PlatformSettingsResponseData>> => {
		const formData = new FormData();
		formData.append("logo", file);
		return API.post("/platform/settings/logo", formData, {
			headers: { "Content-Type": "multipart/form-data" },
		});
	},

	removeLogo: (): Promise<ApiResponse<PlatformSettingsResponseData>> =>
		API.delete("/platform/settings/logo"),
};
