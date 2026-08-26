import Link from "next/link";
import { useStudentCurrentEnrolment } from "../hooks/use-student-enrolment";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { Skeleton } from "@/components/ui/skeleton";

export function StudentClassCard({ studentId, termId }: { studentId: string; termId?: string }) {
	const { data: enrolment, isLoading } = useStudentCurrentEnrolment(studentId, termId);
	const { data: classes } = useClasses();

	if (!termId) return null;
	if (isLoading) return <Skeleton className="h-24 rounded-xl" />;

	const classItem = enrolment ? classes?.find((c) => c.id === enrolment.classId) : null;

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<h3 className="font-medium">Class</h3>
			{classItem ? (
				<Link
					href={`/school-admin/classes/${classItem.id}`}
					className="mt-2 block text-lg font-semibold text-primary hover:underline"
				>
					{classItem.name}
				</Link>
			) : (
				<p className="mt-2 text-sm text-muted-foreground">Not enrolled in a class this term.</p>
			)}
		</div>
	);
}