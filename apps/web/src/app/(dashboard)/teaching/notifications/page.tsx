import { PageHeader } from "@/components/layout/page-header";
import { NotificationInbox } from "@/features/notifications/components/notification-inbox";

export default function TeachingNotificationsPage() {
	return (
		<>
			<PageHeader title="Notifications" />
			<NotificationInbox />
		</>
	);
}