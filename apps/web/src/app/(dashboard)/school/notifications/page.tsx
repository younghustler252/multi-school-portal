"use client";

import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCard } from "@/components/ui/mobile-card";
import { useMyNotifications, useMarkAsRead, useMarkAllAsRead } from "@/features/notifications/hooks/use-notification-inbox";

export default function NotificationsInboxPage() {
	const [page, setPage] = useState(1);
	const { data, isLoading } = useMyNotifications({ page, limit: 20 });
	const markAsRead = useMarkAsRead();
	const markAllAsRead = useMarkAllAsRead();

	const notifications = data?.notifications ?? [];
	const unreadCount = notifications.filter((n) => n.status !== "READ").length;

	return (
		<>
			<PageHeader
				title="Notifications"
				description="Updates and alerts sent to you."
				actions={
					unreadCount > 0 ? (
						<Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
							<CheckCheck className="size-3.5" /> Mark all as read
						</Button>
					) : undefined
				}
			/>

			{isLoading && (
				<div className="space-y-2">
					{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
				</div>
			)}

			{!isLoading && notifications.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					<Bell className="mx-auto mb-2 size-6 opacity-50" />
					No notifications yet.
				</div>
			)}

			{!isLoading && notifications.length > 0 && (
				<div className="space-y-2">
					{notifications.map((delivery) => {
						const isRead = delivery.status === "READ";
						return (
							<button
								key={delivery.id}
								onClick={() => !isRead && markAsRead.mutate(delivery.id)}
								className="block w-full text-left"
							>
								<MobileCard className={!isRead ? "border-primary/30 bg-primary/5" : ""}>
									<div className="flex items-start gap-2">
										{!isRead && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
										<div className="min-w-0 flex-1">
											<div className="text-sm font-medium">{delivery.notification.title}</div>
											<div className="mt-0.5 text-sm text-muted-foreground">{delivery.notification.message}</div>
											<div className="mt-1.5 text-xs text-muted-foreground">
												{new Date(delivery.createdAt).toLocaleDateString()}
											</div>
										</div>
									</div>
								</MobileCard>
							</button>
						);
					})}
				</div>
			)}

			{data?.meta && data.meta.totalPages > 1 && (
				<div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
					<span>Page {data.meta.page} of {data.meta.totalPages}</span>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" disabled={!data.meta.hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
						<Button variant="outline" size="sm" disabled={!data.meta.hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
					</div>
				</div>
			)}
		</>
	);
}