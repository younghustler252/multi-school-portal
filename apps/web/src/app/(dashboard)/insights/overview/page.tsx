"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchoolDashboard } from "@/features/school/hooks/use-school";
import { useAuthStore } from "@/stores/auth.store";
import { attendanceView } from "@/lib/school-dashboard";

// Not part of the dashboard pilot: only the data mapping was corrected here, to the API's real response (sections can
// be null for a role, and the field names changed). The layout is left for its own stage.
export default function PrincipalOverviewPage() {
	const user = useAuthStore((s) => s.user);
	const { data: dashboard, isLoading } = useSchoolDashboard();
	const attendance = dashboard?.attendance ? attendanceView(dashboard.attendance) : null;

	return (
		<>
			<PageHeader
				title={`Welcome, ${user?.firstName ?? ""}`}
				description={dashboard ? `${dashboard.school.name} — school-wide overview` : undefined}
			/>

			{isLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
				</div>
			) : dashboard ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{dashboard.people && (
						<StatCard label="Total Students" value={String(dashboard.people.totalStudents)} accent="primary" hint={`${dashboard.people.activeStudents} active`} />
					)}
					{attendance && (
						<StatCard
							label="Attendance Today"
							value={attendance.ratePercent === null ? "—" : `${attendance.ratePercent}%`}
							accent="success"
						/>
					)}
					{dashboard.people && <StatCard label="Total Staff" value={String(dashboard.people.totalStaff)} accent="info" />}
					{dashboard.academics && <StatCard label="Classes" value={String(dashboard.academics.totalClasses)} accent="warning" />}
				</div>
			) : null}
		</>
	);
}
