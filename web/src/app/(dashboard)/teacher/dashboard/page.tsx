"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth.store";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useTodaysAttendanceStatus } from "@/features/attendance/hooks/use-todays-attendance-status";

function ClassStatusRow({ classId, className, termId }: { classId: string; className: string; termId?: string }) {
	const { data: marked, isLoading } = useTodaysAttendanceStatus(classId, termId);

	return (
		<div className="flex items-center justify-between rounded-lg border border-border p-3">
			<div className="text-sm font-medium">{className}</div>
			{isLoading ? (
				<Skeleton className="h-6 w-20" />
			) : marked ? (
				<Badge variant="secondary"><CheckCircle2 className="size-3" /> Marked today</Badge>
			) : (
				<Button size="sm" variant="outline" render={<Link href={`/teacher/attendance?classId=${classId}`}>Take attendance</Link>} />
			)}
		</div>
	);
}

export default function TeacherDashboardPage() {
	const user = useAuthStore((s) => s.user);
	const { data: classes, isLoading } = useMyClasses();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const subjectCount = new Set(classes?.flatMap((c) => c.subjects.map((s) => s.subjectId))).size;

	return (
		<>
			<PageHeader
				title={`Welcome, ${user?.firstName ?? ""}`}
				description={classes ? `${classes.length} class${classes.length !== 1 ? "es" : ""} assigned` : undefined}
			/>

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
				<StatCard label="My classes" value={String(classes?.length ?? 0)} accent="primary" />
				<StatCard label="Subjects taught" value={String(subjectCount)} accent="info" />
				<StatCard
					label="Attendance status"
					value={termId ? "See below" : "No term set"}
					accent="warning"
				/>
			</div>

			<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
				<h3 className="font-medium">Today&apos;s attendance</h3>

				{isLoading && <Skeleton className="mt-4 h-32 w-full" />}

				{!isLoading && (!classes || classes.length === 0) && (
					<p className="mt-3 text-sm text-muted-foreground">You haven&apos;t been assigned any classes yet.</p>
				)}

				{!termId && classes && classes.length > 0 && (
					<p className="mt-3 text-sm text-muted-foreground">No current term set by your school admin yet.</p>
				)}

				{termId && classes && classes.length > 0 && (
					<div className="mt-4 space-y-2">
						{classes.map((c) => (
							<ClassStatusRow key={c.classId} classId={c.classId} className={c.className} termId={termId} />
						))}
					</div>
				)}
			</div>
		</>
	);
}