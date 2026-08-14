"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";

export default function MyClassesPage() {
	const { data: classes, isLoading } = useMyClasses();

	return (
		<>
			<PageHeader title="My Classes" description="Classes and subjects assigned to you." />

			{isLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
				</div>
			)}

			{!isLoading && classes?.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					You haven&apos;t been assigned to any classes yet.
				</div>
			)}

			{classes && classes.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{classes.map((c) => (
						<div key={c.classId} className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
							<Link href={`/teacher/attendance?classId=${c.classId}`} className="text-lg font-semibold hover:underline">
								{c.className}
							</Link>
							<div className="mt-3 flex flex-wrap gap-1.5">
								{c.subjects.map((s) => (
									<Badge key={s.classSubjectId} variant="secondary" className="font-normal">
										{s.subjectName}
									</Badge>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}