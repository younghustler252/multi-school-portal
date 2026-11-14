import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { PlatformSettingsResponseData, UpdatePlatformSettingsDto } from "../types/platform-settings.types";

export const platformSettingsApi = {
	get: (): Promise<ApiResponse<PlatformSettingsResponseData>> =>
		API.get("/platform/settings"),

	/**
	 * Logo upload (Supabase public bucket, same rules as the school logo: JPEG/PNG/WebP, 2 MB, no SVG).
	 * Contract the frontend expects from the backend: POST /platform/settings/logo, multipart field "logo",
	 * super admin only (platform.settings.manage), responds with the updated settings (logoUrl set).
	 */
	uploadLogo: (file: File): Promise<ApiResponse<PlatformSettingsResponseData>> => {
		const formData = new FormData();
		formData.append("logo", file);
		return API.post("/platform/settings/logo", formData, { headers: { "Content-Type": "multipart/form-data" } });
	},

	update: (data: UpdatePlatformSettingsDto): Promise<ApiResponse<PlatformSettingsResponseData>> =>
		API.put("/platform/settings", data),
};