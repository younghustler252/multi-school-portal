import { useGrades } from "../hooks/use-grades";
import { useSubjects, useClassSubjects } from "@/features/classes/hooks/use-classes";
import { getGradeColor } from "../constants/grade-colors";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentCurrentEnrolment } from "@/features/enrolment/hooks/use-student-enrolment";

export function StudentGradesCard({ studentId, termId }: { studentId: string; termId?: string }) {
	const { data: enrolment } = useStudentCurrentEnrolment(studentId, termId);
	const { data: classSubjects } = useClassSubjects(enrolment?.classId ?? "");
	const { data: allSubjects } = useSubjects();
	const { data: grades, isLoading } = useGrades({ studentId, termId, isPublished: true });

	if (!termId) return null;
	if (isLoading) return <Skeleton className="h-40 rounded-xl" />;

	function subjectName(classSubjectId: string) {
		const cs = classSubjects?.find((c) => c.id === classSubjectId);
		return allSubjects?.find((s) => s.id === cs?.subjectId)?.name ?? "Subject";
	}

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<h3 className="font-medium">Grades this term</h3>
			{!grades || grades.length === 0 ? (
				<p className="mt-3 text-sm text-muted-foreground">No published grades yet.</p>
			) : (
				<div className="mt-3 space-y-2">
					{grades.map((g) => (
						<div key={g.id} className="flex items-center justify-between text-sm">
							<span>{subjectName(g.classSubjectId)}</span>
							<span className={`font-semibold ${getGradeColor(g.grade)}`}>{g.grade ?? "—"}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}