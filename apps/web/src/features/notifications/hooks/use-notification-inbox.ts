import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "../services/notification.api";
import { ListMyNotificationsParams } from "../types/notification.types";
export function useMyNotifications(params: ListMyNotificationsParams) {
	return useQuery({
		queryKey: ["notifications", "me", params],
		queryFn: async () => {
			const res = await notificationApi.getMyNotifications(params);
			if (!res.success) throw res;
			return { notifications: res.data, meta: res.meta };
		},
		refetchInterval: 60_000,
	});
}

export function useUnreadCount() {
	const { data } = useMyNotifications({ limit: 50 });
	return data?.notifications.filter((n) => n.status !== "READ").length ?? 0;
}

export function useMarkAsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => notificationApi.markAsRead(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "me"] }),
	});
}

export function useMarkAllAsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => notificationApi.markAllAsRead(),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "me"] }),
	});
}