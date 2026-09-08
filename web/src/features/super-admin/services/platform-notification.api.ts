import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	PlatformNotificationResponseData,
	SendPlatformNotificationDto,
	ListPlatformNotificationsParams,
} from "../types/platform-notification.types";

export const platformNotificationApi = {

	list: (params: ListPlatformNotificationsParams): Promise<ApiResponse<PlatformNotificationResponseData[]>> =>
		API.get("/notifications/platform", { params }),

	send: (data: SendPlatformNotificationDto): Promise<ApiResponse<PlatformNotificationResponseData>> =>
		API.post("/notifications/platform", data),

};