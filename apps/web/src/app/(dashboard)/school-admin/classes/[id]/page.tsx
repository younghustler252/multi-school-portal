"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Pencil, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ClassSubjectsSection } from "@/features/classes/components/class-subjects-section";
import { SetClassTeacherDialog } from "@/features/classes/components/set-class-teacher-dialog";
import { SetClassProgressionDialog } from "@/features/classes/components/set-class-progression-dialog";
import { ClassRoster } from "@/features/enrolment/components/class-roster";
import { useClass, useDeleteClass } from "@/features/classes/hooks/use-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useStaffMember } from "@/features/staff/hooks/use-staff";
import { ApiErrorResponse } from "@/types/api-response";

export default function ClassDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { data: classItem, isLoading } = useClass(params.id);
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id ?? null;
	const deleteClass = useDeleteClass();

	const { data: classTeacher } = useStaffMember(classItem?.classTeacherId ?? "");

	const [confirmDelete, setConfirmDelete] = useState(false);
	const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
	const [progressionDialogOpen, setProgressionDialogOpen] = useState(false);

	async function handleDelete() {
		try {
			await deleteClass.mutateAsync(params.id);
			toast.success("Class deleted");
			router.push("/school-admin/classes");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't delete class");
		}
	}

	if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
	if (!classItem) return <p className="text-muted-foreground">Class not found.</p>;

	return (
		<>
			<Link href="/school-admin/classes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to classes
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{classItem.name}</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Class teacher: {classTeacher ? `${classTeacher.firstName} ${classTeacher.lastName}` : "Not assigned"}
						<button onClick={() => setTeacherDialogOpen(true)} className="ml-2 text-primary hover:underline">
							<Pencil className="inline size-3" /> Edit
						</button>
					</p>
					<p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
						Promotes to: {classItem.toClassName ?? "Not set"}
						<ArrowRight className="hidden size-3 sm:inline" />
						<button onClick={() => setProgressionDialogOpen(true)} className="text-primary hover:underline">
							<Pencil className="inline size-3" /> Edit
						</button>
					</p>
				</div>

				<Button
					variant="outline"
					className="w-full text-destructive hover:text-destructive sm:w-auto"
					onClick={() => setConfirmDelete(true)}
				>
					<Trash2 className="size-4" /> Delete class
				</Button>
			</div>

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard label="Students" value={String(classItem.studentCount ?? 0)} accent="primary" />
				<StatCard label="Level" value={classItem.level ?? "—"} accent="info" />
				<StatCard label="Capacity" value={classItem.capacity ? String(classItem.capacity) : "—"} accent="warning" />
				<StatCard label="Class teacher" value={classTeacher ? "Assigned" : "Unassigned"} accent="success" />
			</div>

			<div className="space-y-6">
				<ClassSubjectsSection classId={params.id} termId={termId ?? ""} />
				<ClassRoster classId={params.id} termId={termId} />
			</div>

			<SetClassTeacherDialog classId={params.id} open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen} />

			<SetClassProgressionDialog
				classId={params.id}
				currentToClassId={classItem.toClassId}
				open={progressionDialogOpen}
				onOpenChange={setProgressionDialogOpen}
			/>

			<ConfirmDialog
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete ${classItem.name}?`}
				description="This can't be undone."
				confirmLabel="Delete"
				destructive
				isLoading={deleteClass.isPending}
				onConfirm={handleDelete}
			/>
		</>
	);
}
