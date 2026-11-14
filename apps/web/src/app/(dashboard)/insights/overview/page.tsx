"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchoolDashboard } from "@/features/school/hooks/use-school";
import { useAuthStore } from "@/stores/auth.store";
import { formatNaira } from "@/lib/format-money";

export default function PrincipalOverviewPage() {
	const user = useAuthStore((s) => s.user);
	const { data: dashboard, isLoading } = useSchoolDashboard();

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
					<StatCard label="Total Students" value={String(dashboard.people.totalStudents)} accent="primary" hint={`${dashboard.people.activeStudents} active`} />
					<StatCard
						label="Attendance Today"
						value={
							dashboard.attendance.todayPresent + dashboard.attendance.todayAbsent > 0
								? `${Math.round((dashboard.attendance.todayPresent / (dashboard.attendance.todayPresent + dashboard.attendance.todayAbsent)) * 100)}%`
								: "—"
						}
						accent="success"
					/>
					<StatCard label="Total Staff" value={String(dashboard.people.totalStaff)} accent="info" />
					<StatCard label="Classes" value={String(dashboard.academics.totalClasses)} accent="warning" />
				</div>
			) : null}
		</>
	);
}