"use client";

import { useState } from "react";
import { Radio, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { ComposeNotificationCard } from "@/features/notifications/components/compose-notification-card";
import { NOTIFICATION_TYPE_LABELS, TARGET_TYPE_LABELS } from "@/features/notifications/constants/notification-labels";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnnouncementsPage() {
	const { data, isLoading } = useNotifications({ limit: 20 });

	return (
		<>
			<PageHeader title="Announcements" description="Send announcements to staff, parents and students." />

			<div className="grid gap-6 lg:grid-cols-2">
				<ComposeNotificationCard />

				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					<div className="mb-4 font-medium">Recent announcements</div>

					{isLoading && <Skeleton className="h-64" />}

					{!isLoading && data?.notifications.length === 0 && (
						<p className="text-sm text-muted-foreground">No announcements sent yet.</p>
					)}

					<ul className="divide-y divide-border">
						{data?.notifications.map((n) => (
							<li key={n.id} className="py-3">
								<div className="flex items-center gap-2">
									<Radio className="size-3 text-primary" />
									<div className="text-sm font-medium">{n.title}</div>
								</div>
								<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
									<span className="flex items-center gap-1"><Users className="size-3" /> {TARGET_TYPE_LABELS[n.targetType as keyof typeof TARGET_TYPE_LABELS]}</span>
									<span>{n.sentAt ? `sent ${new Date(n.sentAt).toLocaleDateString()}` : "not sent"}</span>
									<span>{NOTIFICATION_TYPE_LABELS[n.type as keyof typeof NOTIFICATION_TYPE_LABELS]}</span>
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</>
	);
}