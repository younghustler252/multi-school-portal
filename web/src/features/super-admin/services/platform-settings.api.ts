import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { PlatformSettingsResponseData, UpdatePlatformSettingsDto } from "../types/platform-settings.types";

export const platformSettingsApi = {
	get: (): Promise<ApiResponse<PlatformSettingsResponseData>> =>
		API.get("/platform-settings"),

	update: (data: UpdatePlatformSettingsDto): Promise<ApiResponse<PlatformSettingsResponseData>> =>
		API.put("/platform-settings", data),
};