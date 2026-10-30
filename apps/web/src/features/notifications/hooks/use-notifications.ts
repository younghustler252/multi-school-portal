import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "../services/notification.api";
import { SendSchoolNotificationDto, ListNotificationsParams } from "../types/notification.types";

export function useNotifications(params: ListNotificationsParams) {
	return useQuery({
		queryKey: ["notifications", params],
		queryFn: async () => {
			const res = await notificationApi.list(params);
			if (!res.success) throw res;
			return { notifications: res.data, meta: res.meta };
		},
	});
}

export function useSendNotification() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: SendSchoolNotificationDto) => {
			const res = await notificationApi.send(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});
}