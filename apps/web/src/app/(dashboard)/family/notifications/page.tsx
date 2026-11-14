import { PageHeader } from "@/components/layout/page-header";
import { NotificationInbox } from "@/features/notifications/components/notification-inbox";

export default function FamilyNotificationsPage() {
	return (
		<>
			<PageHeader title="Notifications" />
			<NotificationInbox />
		</>
	);
}