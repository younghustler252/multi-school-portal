"use client";

import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SendNotificationDialog } from "@/features/notifications/components/send-notification-dialog";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { NOTIFICATION_TYPE_LABELS, TARGET_TYPE_LABELS } from "@/features/notifications/constants/notification-labels";
import { SchoolNotificationType, TargetType } from "@/features/notifications/types/notification.types";

export default function NotificationsPage() {
	const [sendOpen, setSendOpen] = useState(false);
	const { data, isLoading } = useNotifications({ limit: 50 });

	return (
		<>
			<PageHeader
				title="Notifications"
				description="Send announcements and view sent notification history."
				actions={
					<Button onClick={() => setSendOpen(true)}>
						<Send className="size-4" /> Send notification
					</Button>
				}
			/>

			<div className="space-y-3">
				{isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}

				{!isLoading && data?.notifications.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
						No notifications sent yet.
					</div>
				)}

				{data?.notifications.map((n) => (
					<div key={n.id} className="rounded-xl border border-border bg-card/80 p-4 backdrop-blur-sm">
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div>
								<div className="font-medium">{n.title}</div>
								<p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
							</div>
							<div className="flex shrink-0 gap-1.5">
								<Badge variant="outline">{NOTIFICATION_TYPE_LABELS[n.type as SchoolNotificationType]}</Badge>
								<Badge variant="secondary">{TARGET_TYPE_LABELS[n.targetType as TargetType]}</Badge>
							</div>
						</div>
						<div className="mt-2 text-xs text-muted-foreground">
							{n.sentAt ? `Sent ${new Date(n.sentAt).toLocaleString()}` : "Not yet sent"}
						</div>
					</div>
				))}
			</div>

			<SendNotificationDialog open={sendOpen} onOpenChange={setSendOpen} />
		</>
	);
}