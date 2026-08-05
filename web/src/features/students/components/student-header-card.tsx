import { Mail, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "./photo-upload";
import { StudentWithGuardiansResponseData } from "../types/student.types";

interface StudentHeaderCardProps {
	student: StudentWithGuardiansResponseData;
	onPhotoUploaded: (url: string) => void;
}

export function StudentHeaderCard({ student, onPhotoUploaded }: StudentHeaderCardProps) {
	const guardians = student.guardians ?? [];

const primaryGuardian =
  guardians.find((g) => g.isPrimary) ??
  guardians[0];
	return (
		<div className="flex flex-col gap-5 rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm sm:flex-row sm:items-start md:p-6">
			<PhotoUpload
				studentId={student.id}
				photoUrl={student.photoUrl}
				firstName={student.firstName}
				lastName={student.lastName}
				onUploaded={onPhotoUploaded}
			/>

			<div className="min-w-0 flex-1">
				<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
					{student.firstName} {student.lastName}
				</h1>
				<div className="mt-1 text-sm text-muted-foreground">
					{student.admissionNumber ? `#${student.admissionNumber}` : "No admission number"}
					{student.gender && ` · ${student.gender === "male" ? "Male" : "Female"}`}
				</div>

				<div className="mt-3 flex flex-wrap gap-2">
					<Badge variant={student.isActive ? "default" : "secondary"}>
						{student.isActive ? "Active" : "Inactive"}
					</Badge>
					{student.bloodGroup && <Badge variant="outline">{student.bloodGroup}</Badge>}
				</div>

				{primaryGuardian && (
					<div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
						<span className="inline-flex items-center gap-1.5">
							<Mail className="size-3.5 shrink-0" /> {primaryGuardian.email}
						</span>
						{primaryGuardian.phone && (
							<span className="inline-flex items-center gap-1.5">
								<Phone className="size-3.5 shrink-0" /> {primaryGuardian.phone}
							</span>
						)}
						{student.address && (
							<span className="inline-flex items-center gap-1.5">
								<MapPin className="size-3.5 shrink-0" /> {student.address}
							</span>
						)}
					</div>
				)}
			</div>
		</div>
	);
}