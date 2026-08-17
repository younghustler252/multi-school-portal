"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyChildren } from "@/features/guardians/hooks/use-guardian-portal";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { ChildGradesTable } from "@/features/guardians/components/child-grades-table";
import { ChildAttendanceCalendar } from "@/features/guardians/components/child-attendance-calendar";

export default function ChildDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: children, isLoading } = useMyChildren();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const child = children?.find((c) => c.studentId === params.id);

	if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
	if (!child) return <p className="text-muted-foreground">Child not found.</p>;

	return (
		<>
			<Link href="/guardian/children" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to children
			</Link>

			<h1 className="mb-6 text-2xl font-semibold tracking-tight">{child.firstName} {child.lastName}</h1>

			<div className="space-y-6">
				<ChildGradesTable studentId={child.studentId} termId={termId} />
				<ChildAttendanceCalendar studentId={child.studentId} termId={termId} />
			</div>
		</>
	);
}