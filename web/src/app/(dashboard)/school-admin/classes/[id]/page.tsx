"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
	useClasses,
	useClass,
	useClassSubjects,
	useRemoveSubject,
	useDeleteClass,
	useSubjects,
} from "@/features/classes/hooks/use-classes";
import { useStaffList } from "@/features/staff/hooks/use-staff";
import { AssignSubjectDialog } from "@/features/classes/components/assign-subject-dialog";

import { ClassRoster } from "@/features/enrolment/components/class-roster";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";

import { ApiErrorResponse } from "@/types/api-response";

export default function ClassDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { data: classes, isLoading: classesLoading } = useClasses();
	const { data: classItem, isLoading: classLoading } = useClass(params.id)
	const { data: classSubjects, isLoading: subjectsLoading } = useClassSubjects(params.id);
	const { data: allSubjects } = useSubjects();
	const { data: staffData } = useStaffList({ limit: 100 });
	const { data: currentSession } = useCurrentSession();

	const removeSubject = useRemoveSubject(params.id);
	const deleteClass = useDeleteClass();
	const [assignOpen, setAssignOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	async function handleRemoveSubject(classSubjectId: string) {
		try {
			await removeSubject.mutateAsync(classSubjectId);
			toast.success("Subject removed");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't remove subject");
		}
	}

	async function handleDeleteClass() {
		try {
			await deleteClass.mutateAsync(params.id);
			toast.success("Class deleted");
			router.push("/school-admin/classes");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't delete class");
		}
	}

	if (classesLoading) {
		return (
			<>
				<Skeleton className="h-6 w-32" />
				<Skeleton className="mt-4 h-64 rounded-xl" />
			</>
		);
	}

	if (!classItem) return <p className="text-muted-foreground">Class not found.</p>;

	return (
		<>
			<Link href="/school-admin/classes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to classes
			</Link>

			<PageHeader
				title={classItem.name}
				description={classItem.level ? `Level: ${classItem.level}` : undefined}
				actions={
					<Button
						variant="outline"
						className="text-destructive hover:text-destructive"
						onClick={() => setConfirmingDelete(true)}
					>
						<Trash2 className="size-4" /> Delete class
					</Button>
				}
			/>

			{confirmingDelete && (
				<div className="mb-6 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
					<span>Delete {classItem.name}? This can&apos;t be undone.</span>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
						<Button variant="destructive" size="sm" onClick={handleDeleteClass} disabled={deleteClass.isPending}>
							{deleteClass.isPending && <Loader2 className="size-4 animate-spin" />}
							Confirm
						</Button>
					</div>
				</div>
			)}

			<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
				<div className="flex items-center justify-between">
					<h3 className="font-medium">Subjects</h3>
					<Button size="sm" onClick={() => setAssignOpen(true)}>
						<Plus className="size-3.5" /> Assign subject
					</Button>
				</div>

				<div className="mt-4 space-y-2">
					{subjectsLoading && <Skeleton className="h-10 w-full" />}

					{!subjectsLoading && classSubjects?.length === 0 && (
						<p className="py-6 text-center text-sm text-muted-foreground">No subjects assigned yet.</p>
					)}

					{classSubjects?.map((cs) => (
						<div key={cs.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
							<div>
								<div className="text-sm font-medium">{cs.subjectName}</div>
								<div className="text-xs text-muted-foreground">Taught by {cs.teacherName}</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleRemoveSubject(cs.id)}
								disabled={removeSubject.isPending}
							>
								<Trash2 className="size-4 text-muted-foreground" />
							</Button>
						</div>
					))}
				</div>
			</div>
			<div className="mt-6">
				<ClassRoster classId={params.id} termId={currentSession?.currentTerm?.id ?? null} />
			</div>
			<AssignSubjectDialog classId={params.id} open={assignOpen} onOpenChange={setAssignOpen} />
		</>
	);
}