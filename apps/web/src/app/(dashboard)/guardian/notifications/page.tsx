// src/app/(dashboard)/teacher/notifications/page.tsx (same pattern for bursar/principal/student/guardian)
import { PageHeader } from "@/components/layout/page-header";
import { NotificationInbox } from "@/features/notifications/components/notification-inbox";

export default function TeacherNotificationsPage() {
	return (
		<>
			<PageHeader title="Notifications" />
			<NotificationInbox />
		</>
	);
}