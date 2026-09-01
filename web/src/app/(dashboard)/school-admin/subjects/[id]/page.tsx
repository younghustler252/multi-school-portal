"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TeacherPicker } from "@/features/classes/components/teacher-picker";
import { useSubjects, useClasses, useAssignSubject } from "@/features/classes/hooks/use-classes";
import { useSubjectUsage } from "@/features/classes/hooks/use-subject-usage";
import { useStudentsBatch } from "@/features/students/hooks/use-students"; // not used here, remove if unused
import { ApiErrorResponse } from "@/types/api-response";

export default function SubjectDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: subjects, isLoading: subjectsLoading } = useSubjects();
	const { data: classes } = useClasses();
	const { data: usage, isLoading: usageLoading } = useSubjectUsage(params.id);

	const subject = subjects?.find((s) => s.id === params.id);
	const unassignedClasses = classes?.filter((c) => !usage?.some((u) => u.classId === c.id)) ?? [];

	const [assignOpen, setAssignOpen] = useState(false);
	const [selectedClassId, setSelectedClassId] = useState("");
	const [selectedTeacherId, setSelectedTeacherId] = useState("");
	const assignSubject = useAssignSubject(selectedClassId);

	async function handleAssign() {
		if (!selectedClassId || !selectedTeacherId) return;
		try {
			await assignSubject.mutateAsync({ subjectId: params.id, staffId: selectedTeacherId });
			toast.success("Assigned to class");
			setAssignOpen(false);
			setSelectedClassId("");
			setSelectedTeacherId("");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't assign");
		}
	}

	if (subjectsLoading) return <Skeleton className="h-64 rounded-xl" />;
	if (!subject) return <p className="text-muted-foreground">Subject not found.</p>;

	return (
		<>
			<Link href="/school-admin/subjects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to subjects
			</Link>

			<h1 className="text-2xl font-semibold tracking-tight">{subject.name}</h1>
			{subject.code && <p className="mt-1 text-sm text-muted-foreground">Code: {subject.code}</p>}

			<div className="mt-6 rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
				<div className="flex items-center justify-between">
					<h3 className="font-medium">Classes teaching this subject</h3>
					<Button size="sm" onClick={() => setAssignOpen(true)} disabled={unassignedClasses.length === 0}>
						<Plus className="size-3.5" /> Assign to class
					</Button>
				</div>

				{usageLoading && <Skeleton className="mt-4 h-24" />}

				{!usageLoading && (!usage || usage.length === 0) && (
					<p className="mt-3 text-sm text-muted-foreground">Not assigned to any class yet.</p>
				)}

				{usage && usage.length > 0 && (
					<div className="mt-4 space-y-2">
						{usage.map((u) => (
							<div key={u.classSubjectId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
								<Link href={`/school-admin/classes/${u.classId}`} className="font-medium hover:underline">{u.className}</Link>
								<Badge variant="secondary">Teacher assigned</Badge>
							</div>
						))}
					</div>
				)}
			</div>

			<Dialog open={assignOpen} onOpenChange={setAssignOpen}>
				<DialogContent>
					<DialogHeader><DialogTitle>Assign {subject.name} to a class</DialogTitle></DialogHeader>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label className="text-sm text-muted-foreground">Class</label>
							<select
								value={selectedClassId}
								onChange={(e) => setSelectedClassId(e.target.value)}
								className="w-full rounded-md border border-input bg-background p-2 text-sm"
							>
								<option value="">Select a class</option>
								{unassignedClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
						</div>
						<div className="space-y-1.5">
							<label className="text-sm text-muted-foreground">Teacher</label>
							<TeacherPicker value={selectedTeacherId} onChange={(id) => setSelectedTeacherId(id)} />
						</div>
					</div>
					<DialogFooter>
						<Button onClick={handleAssign} disabled={!selectedClassId || !selectedTeacherId || assignSubject.isPending}>
							{assignSubject.isPending && <Loader2 className="size-4 animate-spin" />}
							Assign
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}