"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyNotifications, useUnreadCount, useMarkAsRead } from "@/features/notifications/hooks/use-notification-inbox";

export function NotificationBell({ inboxPath }: { inboxPath: string }) {
	const unreadCount = useUnreadCount();
	const { data } = useMyNotifications({ limit: 5 });
	const markAsRead = useMarkAsRead();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
						<Bell className="size-4" />
						{unreadCount > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />}
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-80">
				<div className="flex items-center justify-between px-2 py-1.5">
					<div className="text-sm font-semibold">Notifications</div>
					<Link href={inboxPath} className="text-xs text-primary hover:underline">View all</Link>
				</div>
				<DropdownMenuSeparator />

				{(!data || data.notifications.length === 0) && (
					<div className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications yet.</div>
				)}

				{data?.notifications.map((delivery) => {
					const isRead = delivery.status === "READ";
					return (
						<button
							key={delivery.id}
							onClick={() => !isRead && markAsRead.mutate(delivery.id)}
							className="w-full rounded-md px-2 py-2 text-left hover:bg-accent/40"
						>
							<div className="flex items-start gap-2">
								{!isRead && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-medium">{delivery.notification.title}</div>
									<div className="line-clamp-2 text-xs text-muted-foreground">{delivery.notification.message}</div>
									<div className="mt-0.5 text-[10px] text-muted-foreground">
										{new Date(delivery.createdAt).toLocaleDateString()}
									</div>
								</div>
							</div>
						</button>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}