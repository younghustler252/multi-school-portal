"use client";

import { Radio } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformNotifications } from "@/features/super-admin/hooks/use-platform-notifications";
import { ComposePlatformNotificationCard } from "@/features/super-admin/components/compose-platform-notification-card";
import { PLATFORM_NOTIFICATION_TYPE_LABELS } from "@/features/super-admin/constants/platform-notification-labels";

export default function PlatformNotificationsPage() {
	const { data, isLoading } = usePlatformNotifications({ limit: 20 });

	return (
		<>
			<PageHeader title="Notifications" description="Send platform-wide messages to schools." />

			<div className="grid gap-6 lg:grid-cols-2">
				<ComposePlatformNotificationCard />

				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					<div className="mb-4 font-medium">Recent notifications</div>

					{isLoading && <Skeleton className="h-64" />}

					{!isLoading && data?.notifications.length === 0 && (
						<p className="text-sm text-muted-foreground">No notifications sent yet.</p>
					)}

					<ul className="divide-y divide-border">
						{data?.notifications.map((n) => (
							<li key={n.id} className="py-3">
								<div className="flex items-center gap-2">
									<Radio className="size-3 text-primary" />
									<div className="text-sm font-medium">{n.title}</div>
								</div>
								<div className="mt-1 text-xs text-muted-foreground">
									{PLATFORM_NOTIFICATION_TYPE_LABELS[n.type as keyof typeof PLATFORM_NOTIFICATION_TYPE_LABELS] ?? n.type} · {n.state}
									{n.sentAt && ` · sent ${new Date(n.sentAt).toLocaleDateString()}`}
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</>
	);
}