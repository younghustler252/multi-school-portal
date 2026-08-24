"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useMyStudentProfile, useMyGrades, useMyAttendance, useMyInvoices } from "@/features/students/hooks/use-student-portal";
import { formatNaira } from "@/lib/format-money";

export default function StudentDashboardPage() {
	const user = useAuthStore((s) => s.user);
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
	const { data: grades } = useMyGrades(termId);
	const { data: attendance } = useMyAttendance(termId);
	const { data: invoices } = useMyInvoices(termId);

	const publishedGrades = grades?.filter((g) => g.isPublished) ?? [];
	const avgTotal = publishedGrades.length > 0
		? Math.round(publishedGrades.reduce((sum, g) => sum + (g.total ?? 0), 0) / publishedGrades.length)
		: null;

	const present = attendance?.filter((a) => a.status === "present").length ?? 0;
	const attendancePct = attendance && attendance.length > 0 ? Math.round((present / attendance.length) * 100) : null;

	const totalOwed = invoices?.reduce((sum, i) => sum + i.balanceKobo, 0) ?? 0;

	return (
		<>
			<PageHeader
				title={`Hello, ${user?.firstName ?? ""}`}
				description={profile ? `${profile.admissionNumber ? `#${profile.admissionNumber}` : ""}` : undefined}
				actions={<Button nativeButton={false} render={<Link href="/student/report-cards"><FileText className="size-4" /> Report card</Link>} />}
			/>

			{profileLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard label="Term average" value={avgTotal !== null ? `${avgTotal}%` : "—"} accent="primary" />
					<StatCard label="Attendance" value={attendancePct !== null ? `${attendancePct}%` : "—"} accent="success" />
					<StatCard label="Outstanding fees" value={formatNaira(totalOwed)} accent="warning" />
					<StatCard label="Subjects graded" value={String(publishedGrades.length)} accent="info" />
				</div>
			)}
		</>
	);
}