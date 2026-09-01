"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { TeacherPicker } from "./teacher-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSubjects, useClassSubjects, useAssignSubject, useRemoveSubject } from "../hooks/use-classes";
import { useStaffList } from "@/features/staff/hooks/use-staff";
import { Loader2, X } from "lucide-react";
import { ApiErrorResponse } from "@/types/api-response";

export function SubjectTags({ classId }: { classId: string }) {
	const { data: allSubjects } = useSubjects();
	const { data: classSubjects } = useClassSubjects(classId);
	const { data: staffData } = useStaffList({ limit: 100 });
	const assignSubject = useAssignSubject(classId);
	const removeSubject = useRemoveSubject(classId);

	const [pickerOpen, setPickerOpen] = useState(false);
	const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
	const [selectedTeacherId, setSelectedTeacherId] = useState("");

	function teacherName(staffId: string) {
		const s = staffData?.staff.find((s) => s.id === staffId);
		return s ? `${s.firstName} ${s.lastName}` : "Assigned";
	}

	function assignedFor(subjectId: string) {
		return classSubjects?.find((cs) => cs.subjectId === subjectId);
	}

	function openPicker(subjectId: string) {
		setActiveSubjectId(subjectId);
		setSelectedTeacherId("");
		setPickerOpen(true);
	}

	async function handleAssign() {
		if (!activeSubjectId || !selectedTeacherId) return;
		try {
			await assignSubject.mutateAsync({ subjectId: activeSubjectId, staffId: selectedTeacherId });
			toast.success("Subject assigned");
			setPickerOpen(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't assign subject");
		}
	}

	async function handleRemove(classSubjectId: string, e: React.MouseEvent) {
		e.stopPropagation();
		try {
			await removeSubject.mutateAsync(classSubjectId);
			toast.success("Subject removed");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't remove subject");
		}
	}

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
			<h3 className="font-medium">Subjects</h3>
			<p className="mt-1 text-xs text-muted-foreground">Click a subject to assign or reassign a teacher.</p>

			<div className="mt-4 flex flex-wrap gap-2">
				{allSubjects?.map((subject) => {
					const assignment = assignedFor(subject.id);
					return (
						<button
							key={subject.id}
							onClick={() => (assignment ? undefined : openPicker(subject.id))}
							className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
								assignment
									? "border-primary/40 bg-primary/10 text-primary"
									: "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
							}`}
						>
							{subject.name}
							{assignment && (
								<>
									<span className="text-xs opacity-70">— {teacherName(assignment.staffId)}</span>
									<X
										className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
										onClick={(e) => handleRemove(assignment.id, e)}
									/>
								</>
							)}
						</button>
					);
				})}
			</div>

			<Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
				<DialogContent>
					<DialogHeader><DialogTitle>Assign teacher</DialogTitle></DialogHeader>
					<TeacherPicker value={selectedTeacherId} onChange={(id) => setSelectedTeacherId(id)} />
					<DialogFooter>
						<Button onClick={handleAssign} disabled={!selectedTeacherId || assignSubject.isPending}>
							{assignSubject.isPending && <Loader2 className="size-4 animate-spin" />}
							Assign
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}