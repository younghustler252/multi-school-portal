import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StudentAvatar } from "./student-avatar";
import { StudentResponseData } from "../types/student.types";

export function StudentCard({ student }: { student: StudentResponseData }) {
	return (
		<Link
			href={`/school-admin/students/${student.id}`}
			className="flex items-center gap-3 rounded-xl border border-border bg-card/80 p-4 backdrop-blur-sm"
		>
			<StudentAvatar photoUrl={student.photoUrl} firstName={student.firstName} lastName={student.lastName} size={44} />
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium">{student.firstName} {student.lastName}</div>
				<div className="text-xs text-muted-foreground">
					{student.admissionNumber ? `#${student.admissionNumber}` : "No admission number"}
					{student.gender && ` · ${student.gender === "male" ? "Male" : "Female"}`}
				</div>
			</div>
			<Badge variant={student.isActive ? "default" : "secondary"} className="shrink-0">
				{student.isActive ? "Active" : "Inactive"}
			</Badge>
		</Link>
	);
}