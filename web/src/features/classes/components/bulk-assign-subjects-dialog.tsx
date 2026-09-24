"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { TeacherPicker } from "./teacher-picker";
import { useSubjects, useBulkAssignSubjects } from "../hooks/use-classes";
import { ApiErrorResponse } from "@/types/api-response";

interface BulkAssignSubjectsDialogProps {
	classId: string;
	termId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BulkAssignSubjectsDialog({ classId, termId, open, onOpenChange }: BulkAssignSubjectsDialogProps) {
	const { data: allSubjects } = useSubjects();
	const bulkAssignSubjects = useBulkAssignSubjects();

	const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
	const [teacherId, setTeacherId] = useState("");

	function toggleSubject(id: string) {
		setSelectedSubjectIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
	}

	function selectAll() {
		setSelectedSubjectIds(allSubjects?.map((s) => s.id) ?? []);
	}

	async function handleSave() {
		if (!teacherId || selectedSubjectIds.length === 0) return;
		try {
			await bulkAssignSubjects.mutateAsync({
				classId,
				data: { staffId: teacherId, subjectIds: selectedSubjectIds, termId },
			});
			toast.success(`${selectedSubjectIds.length} subject${selectedSubjectIds.length !== 1 ? "s" : ""} assigned`);
			setSelectedSubjectIds([]);
			setTeacherId("");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't assign subjects");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Assign multiple subjects</DialogTitle>
					<DialogDescription>Pick the subjects and the teacher who'll take them for this class.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<div className="mb-2 flex items-center justify-between">
							<label className="text-xs text-muted-foreground">Subjects</label>
							<button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">
								Select all
							</button>
						</div>
						<div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
							{allSubjects?.map((subject) => (
								<label
									key={subject.id}
									className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
								>
									<Checkbox
										checked={selectedSubjectIds.includes(subject.id)}
										onCheckedChange={() => toggleSubject(subject.id)}
									/>
									{subject.name}
								</label>
							))}
						</div>
					</div>

					<div className="space-y-1.5">
						<label className="text-xs text-muted-foreground">Teacher</label>
						<TeacherPicker value={teacherId} onChange={setTeacherId} />
					</div>
				</div>

				<DialogFooter>
					<Button
						onClick={handleSave}
						disabled={!teacherId || selectedSubjectIds.length === 0 || bulkAssignSubjects.isPending}
					>
						{bulkAssignSubjects.isPending && <Loader2 className="size-4 animate-spin" />}
						Assign {selectedSubjectIds.length > 0 ? `${selectedSubjectIds.length} ` : ""}subject{selectedSubjectIds.length !== 1 ? "s" : ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
