"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Loader2, GraduationCap, ClipboardCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentHeaderCard } from "@/features/students/components/student-header-card";
import { StudentGuardiansPanel } from "@/features/students/components/student-guardians-panel";
import { InfoRow } from "@/components/ui/info-row";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { EditStudentDialog } from "@/features/students/components/edit-student-dialog";
import { StudentClassCard } from "@/features/enrolment/components/student-class-card";
import { AttendanceSummaryCard } from "@/features/attendance/components/attendance-summary-card";
import { StudentGradesCard } from "@/features/grades/components/student-grades-card";
import { StudentFeesCard } from "@/features/fees/components/student-fees-card";


import { ComingSoon } from "@/components/feedback/coming-soon";
import { useStudent, useDeactivateStudent, usePatchStudentPhoto } from "@/features/students/hooks/use-students";
import { ApiErrorResponse } from "@/types/api-response";

export default function StudentDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { data: student, isLoading } = useStudent(params.id);
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;
	const deactivateStudent = useDeactivateStudent();
	const patchPhoto = usePatchStudentPhoto();
	const [editOpen, setEditOpen] = useState(false);
	const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

	async function handleDeactivate() {
		try {
			await deactivateStudent.mutateAsync(params.id);
			toast.success("Student deactivated");
			router.push("/school-admin/students");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't deactivate student");
		}
	}

	if (isLoading) {
		return (
			<>
				<Skeleton className="h-6 w-32" />
				<Skeleton className="mt-4 h-40 rounded-2xl" />
				<Skeleton className="mt-4 h-64 rounded-xl" />
			</>
		);
	}

	if (!student) return <p className="text-muted-foreground">Student not found.</p>;

	return (
		<>
			<Link href="/school-admin/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to students
			</Link>

			<StudentHeaderCard student={student} onPhotoUploaded={(url) => patchPhoto(student.id, url)} />

			<div className="mt-4 flex flex-wrap justify-end gap-2">
				<Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
					<Pencil className="size-4" /> Edit
				</Button>
				{student.isActive && (
					<Button
						variant="outline"
						size="sm"
						className="text-destructive hover:text-destructive"
						onClick={() => setConfirmingDeactivate(true)}
					>
						<Trash2 className="size-4" /> Deactivate
					</Button>
				)}
			</div>

			{confirmingDeactivate && (
				<div className="mt-3 flex flex-col items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm sm:flex-row sm:items-center">
					<span>Deactivate {student.firstName} {student.lastName}?</span>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivate(false)}>Cancel</Button>
						<Button variant="destructive" size="sm" onClick={handleDeactivate} disabled={deactivateStudent.isPending}>
							{deactivateStudent.isPending && <Loader2 className="size-4 animate-spin" />}
							Confirm
						</Button>
					</div>
				</div>
			)}

			<div className="mt-6 grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
						<h3 className="font-medium">Student information</h3>
						<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
							<InfoRow label="Middle name" value={student.middleName} />
							<InfoRow label="Date of birth" value={student.dateOfBirth?.slice(0, 10)} />
							<InfoRow label="Admission date" value={student.admittedAt?.slice(0, 10)} />
							<InfoRow label="Religion" value={student.religion} />
							<InfoRow label="Nationality" value={student.nationality} />
							<InfoRow label="State of origin" value={student.stateOfOrigin} />
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-3">
						<StudentClassCard studentId={student.id} termId={termId} />
						<AttendanceSummaryCard studentId={student.id} termId={termId} />
						<StudentGradesCard studentId={student.id} termId={termId} />
					</div>
					<div className="mt-4">
						<StudentFeesCard studentId={student.id} termId={termId} />
					</div>
				</div>

				<StudentGuardiansPanel studentId={student.id} guardians={student.guardians} />
			</div>

			<EditStudentDialog student={student} open={editOpen} onOpenChange={setEditOpen} />
		</>
	);
}