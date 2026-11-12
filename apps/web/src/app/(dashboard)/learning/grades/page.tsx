"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useMyGrades } from "@/features/students/hooks/use-student-portal";

export default function StudentGradesPage() {
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;
	const { data: grades, isLoading } = useMyGrades(termId);

	const published = grades?.filter((g) => g.isPublished) ?? [];

	return (
		<>
			<PageHeader title="My Grades" description="Published results for this term." />

			{isLoading && <Skeleton className="h-64 rounded-xl" />}

			{!isLoading && published.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					No published grades yet.
				</div>
			)}

			{published.length > 0 && (
				<div className="overflow-hidden rounded-xl border border-border bg-card/60">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-xs text-muted-foreground">
							<tr>
								<th className="px-4 py-3 text-left">Subject</th>
								<th className="py-3 text-center">CA</th>
								<th className="py-3 text-center">Exam</th>
								<th className="py-3 text-center">Total</th>
								<th className="py-3 text-center">Grade</th>
								<th className="py-3 pr-4 text-center">Position</th>
							</tr>
						</thead>
						<tbody>
							{published.map((g) => (
								<tr key={g.id} className="border-t border-border">
									<td className="px-4 py-3 font-medium">{g.classSubjectId}</td>
									<td className="text-center text-muted-foreground">{g.caScore ?? "—"}</td>
									<td className="text-center text-muted-foreground">{g.examScore ?? "—"}</td>
									<td className="text-center font-semibold">{g.total ?? "—"}</td>
									<td className="text-center"><Badge variant="secondary">{g.grade ?? "—"}</Badge></td>
									<td className="pr-4 text-center text-muted-foreground">
										{g.position ? `${g.position}/${g.totalStudents}` : "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
}