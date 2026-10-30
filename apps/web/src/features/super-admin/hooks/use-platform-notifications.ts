import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformNotificationApi } from "../services/platform-notification.api";
import { SendPlatformNotificationDto, ListPlatformNotificationsParams } from "../types/platform-notification.types";

export function usePlatformNotifications(params: ListPlatformNotificationsParams) {
	return useQuery({
		queryKey: ["super-admin", "notifications", params],
		queryFn: async () => {
			const res = await platformNotificationApi.list(params);
			if (!res.success) throw res;
			return { notifications: res.data, meta: res.meta };
		},
	});
}

export function useSendPlatformNotification() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: SendPlatformNotificationDto) => platformNotificationApi.send(data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "notifications"] }),
	});
}