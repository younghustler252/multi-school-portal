import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherAssignments } from "../hooks/use-teacher-assignments";

export function TeacherAssignmentsPanel({ staffId }: { staffId: string }) {
	const { data: assignments, isLoading } = useTeacherAssignments(staffId);

	if (isLoading) return <Skeleton className="h-40 rounded-xl" />;

	const classNames = [...new Set(assignments?.map((a) => a.className))];
	const subjectLabels = [...new Set(assignments?.map((a) => a.subjectCode ? `${a.subjectName} (${a.subjectCode})` : a.subjectName))];

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
			<h3 className="font-medium">Teaching assignments</h3>

			{!assignments || assignments.length === 0 ? (
				<p className="mt-3 text-sm text-muted-foreground">No classes or subjects assigned yet.</p>
			) : (
				<>
					<div className="mt-4">
						<div className="text-xs text-muted-foreground">Subjects</div>
						<div className="mt-1.5 flex flex-wrap gap-1.5">
							{subjectLabels.map((s) => <Badge key={s} variant="outline" className="font-normal">{s}</Badge>)}
						</div>
					</div>
					<div className="mt-3">
						<div className="text-xs text-muted-foreground">Classes</div>
						<div className="mt-1.5 flex flex-wrap gap-1.5">
							{classNames.map((c) => {
								const assignment = assignments.find((a) => a.className === c);
								return (
									<Link key={c} href={`/school-admin/classes/${assignment?.classId}`}>
										<Badge variant="secondary">{c}</Badge>
									</Link>
								);
							})}
						</div>
					</div>
				</>
			)}
		</div>
	);
}