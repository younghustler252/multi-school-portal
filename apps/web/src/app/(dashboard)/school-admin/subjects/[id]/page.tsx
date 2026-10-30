"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TeacherPicker } from "@/features/classes/components/teacher-picker";
import { DefaultTeacherCard } from "@/features/classes/components/default-teacher-card";
import { useSubjects, useClasses, useAssignSubject } from "@/features/classes/hooks/use-classes";
import { useSubjectUsage } from "@/features/classes/hooks/use-subject-usage";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { ApiErrorResponse } from "@/types/api-response";

export default function SubjectDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: subjects, isLoading: subjectsLoading } = useSubjects();
	const { data: classes } = useClasses();
	const { data: usage, isLoading: usageLoading } = useSubjectUsage(params.id, termId);

	const subject = subjects?.find((s) => s.id === params.id);
	const assignedClassIds = new Set(usage?.filter((u) => u.staffId).map((u) => u.classId) ?? []);
	const availableClasses = classes?.filter((c) => !assignedClassIds.has(c.id)) ?? [];

	const [assignOpen, setAssignOpen] = useState(false);
	const [selectedClassId, setSelectedClassId] = useState("");
	const [selectedTeacherId, setSelectedTeacherId] = useState("");
	const assignSubject = useAssignSubject();

	async function handleAssign() {
		if (!selectedClassId || !selectedTeacherId || !termId) return;
		try {
			await assignSubject.mutateAsync({
				classId: selectedClassId,
				data: { subjectId: params.id, staffId: selectedTeacherId, termId },
			});
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

			{!termId && (
				<p className="mt-4 text-sm text-muted-foreground">No current term set — set one in Settings → Term &amp; calendar.</p>
			)}

			<div className="mt-6 space-y-6">
				<DefaultTeacherCard subjectId={subject.id} defaultTeacherId={subject.defaultTeacherId} />

				<div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<h3 className="font-medium">Classes teaching this subject</h3>
						<Button size="sm" onClick={() => setAssignOpen(true)} disabled={availableClasses.length === 0 || !termId}>
							<Plus className="size-3.5" /> Assign to class
						</Button>
					</div>

					{usageLoading && <Skeleton className="mt-4 h-24" />}

					{!usageLoading && (!usage || usage.filter((u) => u.staffId).length === 0) && (
						<p className="mt-3 text-sm text-muted-foreground">Not assigned to any class yet.</p>
					)}

					{usage && usage.filter((u) => u.staffId).length > 0 && (
						<div className="mt-4 space-y-2">
							{usage.filter((u) => u.staffId).map((u) => (
								<div key={u.classId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
									<Link href={`/school-admin/classes/${u.classId}`} className="font-medium hover:underline">{u.className}</Link>
									<span className="text-muted-foreground">{u.teacherName}</span>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<Dialog open={assignOpen} onOpenChange={setAssignOpen}>
				<DialogContent>
					<DialogHeader><DialogTitle>Assign {subject.name} to a class</DialogTitle></DialogHeader>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label className="text-sm text-muted-foreground">Class</label>
							<Select value={selectedClassId} onValueChange={(v) => setSelectedClassId(v ?? "")}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select a class">
										{() => availableClasses.find((c) => c.id === selectedClassId)?.name ?? "Select a class"}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{availableClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
								</SelectContent>
							</Select>
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