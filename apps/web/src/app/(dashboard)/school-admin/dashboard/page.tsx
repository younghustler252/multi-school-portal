"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SetupChecklistCard } from "@/components/school-admin/setup-checklist-card";
import { useSetupChecklist, useSchoolDashboard } from "@/features/school/hooks/use-school";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/format-money";

export default function SchoolAdminDashboardPage() {
	const { data: checklist, isLoading: checklistLoading } = useSetupChecklist();
	const { data: dashboard, isLoading: dashboardLoading } = useSchoolDashboard();

	return (
		<>
			<PageHeader
				title="Dashboard"
				description={
					dashboard
						? `Welcome back — here's what's happening at ${dashboard.school.name}.`
						: "Welcome back."
				}
			/>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
					{dashboardLoading ? (
						<>
							<Skeleton className="h-32 rounded-xl" />
							<Skeleton className="h-32 rounded-xl" />
							<Skeleton className="h-32 rounded-xl" />
							<Skeleton className="h-32 rounded-xl" />
						</>
					) : dashboard ? (
						<>
							<StatCard
								label="Total Students"
								value={String(dashboard.people.totalStudents)}
								accent="primary"
								hint={`${dashboard.people.activeStudents} active`}
							/>
							<StatCard
								label="Attendance Today"
								value={
									dashboard.attendance.todayPresent + dashboard.attendance.todayAbsent > 0
										? `${Math.round(
												(dashboard.attendance.todayPresent /
													(dashboard.attendance.todayPresent + dashboard.attendance.todayAbsent)) *
													100
											)}%`
										: "—"
								}
								accent="success"
								hint={`${dashboard.attendance.todayAbsent} absent, ${dashboard.attendance.todayLate} late`}
							/>
							<StatCard
								label="Fee Defaulters"
								value={String(dashboard.fees.defaulters)}
								accent="warning"
								hint={`${formatNaira(dashboard.fees.totalPending)} outstanding`}
							/>
							<StatCard
								label="Staff Members"
								value={String(dashboard.people.totalStaff)}
								accent="info"
								hint={`${dashboard.people.activeStaff} active`}
							/>
						</>
					) : null}
				</div>

				{checklistLoading && <Skeleton className="h-96 rounded-xl" />}
				{checklist && <SetupChecklistCard checklist={checklist} />}
			</div>

			{dashboard && (
				<div className="mt-6 rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
					You&apos;re on the <span className="font-medium text-foreground">{dashboard.plan.name}</span> plan —{" "}
					{dashboard.people.totalStudents}/{dashboard.plan.studentLimit} students,{" "}
					{dashboard.people.totalStaff}/{dashboard.plan.staffLimit} staff.
				</div>
			)}
		</>
	);
}