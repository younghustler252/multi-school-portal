import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	SchoolNotificationResponseData,
	SendSchoolNotificationDto,
	ListNotificationsParams,
} from "../types/notification.types";

export const notificationApi = {

	list: (params: ListNotificationsParams): Promise<ApiResponse<SchoolNotificationResponseData[]>> =>
		API.get("/notifications/school", {
			params: {
				page: params.page,
				limit: params.limit,
				type: params.type,
				state: params.state,
			},
		}),

	send: (data: SendSchoolNotificationDto): Promise<ApiResponse<SchoolNotificationResponseData>> =>
		API.post("/notifications/school", data),

};