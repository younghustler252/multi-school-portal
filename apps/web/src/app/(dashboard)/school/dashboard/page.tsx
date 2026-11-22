"use client";

import { useState } from "react";
import { ClipboardCheck, GraduationCap, Receipt, Settings, UserPlus, Users, Wallet } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { AttendancePanel } from "@/components/school-admin/attendance-panel";
import { FeesPanel } from "@/components/school-admin/fees-panel";
import { PlanPanel } from "@/components/school-admin/plan-panel";
import { QuickActions, type QuickAction } from "@/components/school-admin/quick-actions";
import { SetupChecklistCard } from "@/components/school-admin/setup-checklist-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useSchoolDashboard, useSetupChecklist } from "@/features/school/hooks/use-school";
import { useAccess } from "@/lib/use-access";
import { canOpenRoute } from "@/lib/route-access";
import { formatNaira } from "@/lib/format-money";
import { ROUTES } from "@/lib/routes";
import { attendanceScopeLabel, attendanceView, hasNothingToShow } from "@/lib/school-dashboard";
import { useAuthStore } from "@/stores/auth.store";

/*
| School administrator dashboard.
| Every number comes from GET /school/dashboard (already limited by the API to what this role may see: a section the
| role cannot see arrives as null and is simply not drawn) and the setup checklist. Nothing is computed from made-up data,
| and a link is offered only for a page this session can open. The API stays the authority on access.
| The figures are school-wide: the endpoint takes no branch parameter (see docs/UI_UX_REDESIGN.md, "Backend gaps").
*/

const ACTIONS: { href: string; label: string; icon: QuickAction["icon"] }[] = [
	{ href: ROUTES.school.students.new, label: "Add a student", icon: UserPlus },
	{ href: ROUTES.school.staff.new, label: "Add a staff member", icon: Users },
	{ href: ROUTES.school.attendance, label: "Take attendance", icon: ClipboardCheck },
	{ href: ROUTES.school.fees.list, label: "Review fees", icon: Wallet },
	{ href: ROUTES.school.settings, label: "School settings", icon: Settings },
];

function DashboardSkeleton() {
	return (
		<div aria-busy="true" aria-label="Loading dashboard" className="space-y-6">
			<div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Skeleton className="h-56 rounded-xl" />
					<Skeleton className="h-56 rounded-xl" />
				</div>
				<div className="space-y-6">
					<Skeleton className="h-44 rounded-xl" />
					<Skeleton className="h-44 rounded-xl" />
				</div>
			</div>
		</div>
	);
}

export default function SchoolAdminDashboardPage() {
	const me = useAccess();
	const permissions = useAuthStore((s) => s.permissions);
	// Read once so "plan ends in N days" does not shift between renders.
	const [now] = useState(() => new Date());

	const dashboard = useSchoolDashboard();
	const checklistQuery = useSetupChecklist(me.can("school.update"));

	const data = dashboard.data;
	const checklist = checklistQuery.data;
	const setupIncomplete = !!checklist && checklist.completionPercent < 100;

	const open = (href: string) => (canOpenRoute(href, permissions) ? href : undefined);
	const actions = ACTIONS.filter((a) => canOpenRoute(a.href, permissions));

	if (dashboard.isError) {
		return (
			<>
				<PageHeader title="Dashboard" />
				<ErrorState
					title="We couldn't load the dashboard"
					description="Your figures are safe. Check your connection and try again."
					onRetry={() => void dashboard.refetch()}
					retrying={dashboard.isFetching}
				/>
			</>
		);
	}

	if (dashboard.isLoading || !data) {
		return (
			<>
				<PageHeader title="Dashboard" />
				<DashboardSkeleton />
			</>
		);
	}

	const term = data.academics?.currentTerm ?? data.fees?.term ?? null;
	const attendance = data.attendance ? attendanceView(data.attendance) : null;
	// The API returns `people` to anyone who may view students OR staff, so each count is shown only to someone who may see it.
	const canSeeStudents = !!data.people && me.can("students.view");
	const canSeeStaff = !!data.people && me.can("staff.view");
	const attendanceHint = (() => {
		if (!attendance) return undefined;
		const base = attendance.marked === 0 ? "Not marked yet" : attendance.ratePercent === null ? "All marked are excused" : `${attendance.counted} counted`;
		const scope = data.attendance?.scope;
		const label = scope && scope !== "ALL" ? attendanceScopeLabel(scope) : null;
		return label ? `${base} · ${label}` : base;
	})();

	return (
		<>
			<PageHeader title="Dashboard" description={term ? `${data.school.name} · ${term}` : data.school.name} />

			{!hasNothingToShow(data) && (
				<section aria-label="Key figures" className="mb-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
					{data.people && canSeeStudents && (
						<StatCard
							label="Students"
							value={String(data.people.totalStudents)}
							hint={`${data.people.activeStudents} active`}
							icon={GraduationCap}
							accent="primary"
						/>
					)}
					{data.people && canSeeStaff && (
						<StatCard
							label="Staff"
							value={String(data.people.totalStaff)}
							hint={`${data.people.activeStaff} active`}
							icon={Users}
							accent="info"
						/>
					)}
					{attendance && (
						<StatCard
							label="Attendance today"
							value={attendance.ratePercent === null ? "—" : `${attendance.ratePercent}%`}
							hint={attendanceHint}
							icon={ClipboardCheck}
							accent="success"
						/>
					)}
					{data.fees && (
						<StatCard
							label="Fees outstanding"
							value={formatNaira(data.fees.totalPendingKobo)}
							hint={data.fees.overdueInvoices > 0 ? `${data.fees.overdueInvoices} overdue` : "None overdue"}
							icon={Receipt}
							accent="warning"
						/>
					)}
				</section>
			)}

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{data.attendance && <AttendancePanel data={data.attendance} href={open(ROUTES.school.attendance)} />}
					{data.fees && <FeesPanel data={data.fees} href={open(ROUTES.school.fees.list)} />}
					{hasNothingToShow(data) && (
						<EmptyState
							title="No figures to show for your role"
							description="Your account doesn't include any dashboard figures. Use the menu to open the pages you work in."
						/>
					)}
				</div>

				{/* A school that is still being set up sees the checklist first, even on a phone. */}
				<div className={setupIncomplete ? "order-first space-y-6 lg:order-none" : "space-y-6"}>
					{checklist && setupIncomplete && <SetupChecklistCard checklist={checklist} />}
					<QuickActions actions={actions} />
					<PlanPanel
						plan={data.plan}
						students={canSeeStudents ? data.people!.totalStudents : null}
						staff={canSeeStaff ? data.people!.totalStaff : null}
						now={now}
					/>
				</div>
			</div>
		</>
	);
}
