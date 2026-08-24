"use client";

import { useMyChildrenGrades } from "../hooks/use-guardian-portal";
import { useClassSubjects } from "@/features/classes/hooks/use-classes";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface ChildGradesTableProps {
	studentId: string;
	classId?: string;
	termId?: string;
}

export function ChildGradesTable({ studentId, classId, termId }: ChildGradesTableProps) {
	const { data: grades, isLoading } = useMyChildrenGrades({ studentId, termId });
	const { data: classSubjects } = useClassSubjects(classId ?? "");

	function subjectName(classSubjectId: string) {
		return classSubjects?.find((c) => c.id === classSubjectId)?.subjectName ?? "Subject";
	}

	if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

	const published = grades?.filter((g) => g.isPublished) ?? [];

	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card/80">
			<div className="border-b border-border p-4 font-medium">Grades this term</div>
			{published.length === 0 ? (
				<p className="p-6 text-center text-sm text-muted-foreground">No published grades yet.</p>
			) : (
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Subject</th>
							<th className="py-3 text-center">CA</th>
							<th className="py-3 text-center">Exam</th>
							<th className="py-3 text-center">Total</th>
							<th className="py-3 text-center">Grade</th>
							<th className="py-3 pr-4 text-center">Remark</th>
						</tr>
					</thead>
					<tbody>
						{published.map((g) => (
							<tr key={g.id} className="border-t border-border">
								<td className="px-4 py-3 font-medium">{subjectName(g.classSubjectId)}</td>
								<td className="text-center text-muted-foreground">{g.caScore ?? "—"}</td>
								<td className="text-center text-muted-foreground">{g.examScore ?? "—"}</td>
								<td className="text-center font-semibold">{g.total ?? "—"}</td>
								<td className="text-center"><Badge variant="secondary">{g.grade ?? "—"}</Badge></td>
								<td className="pr-4 text-center text-muted-foreground">{g.remark ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}