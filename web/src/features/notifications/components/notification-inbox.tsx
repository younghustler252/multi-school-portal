"use client";

import { CheckCheck, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useMyNotifications,
	useMarkAsRead,
	useMarkAllAsRead,
} from "../hooks/use-notification-inbox";
import { NOTIFICATION_TYPE_LABELS } from "../constants/notification-labels";

export function NotificationInbox() {
	const { data, isLoading } = useMyNotifications({ limit: 50 });
	const markAsRead = useMarkAsRead();
	const markAllAsRead = useMarkAllAsRead();

	const unreadCount =
		data?.notifications.filter((n) => n.status !== "READ").length ?? 0;

	return (
		<>
			{unreadCount > 0 && (
				<div className="mb-4 flex justify-end">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => markAllAsRead.mutate()}
						disabled={markAllAsRead.isPending}
						className="text-muted-foreground hover:text-foreground"
					>
						<CheckCheck className="size-3.5" />
						Mark all as read
					</Button>
				</div>
			)}

			<div className="space-y-2">
				{isLoading &&
					Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))}

				{!isLoading && data?.notifications.length === 0 && (
					<div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
						<Bell className="mx-auto mb-3 size-6 opacity-40" />
						<p className="text-sm">No notifications yet.</p>
					</div>
				)}

				{data?.notifications.map((delivery) => {
					const isRead = delivery.status === "READ";

					return (
						<button
							key={delivery.id}
							type="button"
							onClick={() =>
								!isRead && markAsRead.mutate(delivery.id)
							}
							className={`group relative block w-full rounded-xl border p-4 text-left transition-colors ${
								isRead
									? "border-border bg-card hover:bg-muted/40"
									: "border-primary/20 bg-primary/[0.04] hover:bg-primary/[0.07]"
							}`}
						>
							{!isRead && (
								<span className="absolute left-0 top-4 h-8 w-0.5 rounded-r-full bg-primary" />
							)}

							<div className="flex items-start gap-3">
								<div
									className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
										isRead
											? "bg-muted text-muted-foreground"
											: "bg-primary/10 text-primary"
									}`}
								>
									<Bell className="size-3.5" />
								</div>

								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<span
											className={`font-medium ${
												isRead
													? "text-muted-foreground"
													: "text-foreground"
											}`}
										>
											{delivery.notification.title}
										</span>

										<Badge
											variant="outline"
											className="shrink-0 text-[10px]"
										>
											{
												NOTIFICATION_TYPE_LABELS[
													delivery.notification.type
												]
											}
										</Badge>
									</div>

									<p className="mt-1 text-sm text-muted-foreground">
										{delivery.notification.message}
									</p>

									<div className="mt-2 text-xs text-muted-foreground/70">
										{new Date(
											delivery.createdAt,
										).toLocaleString()}
									</div>
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</>
	);
}
