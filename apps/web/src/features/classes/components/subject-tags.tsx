// "use client";

// import { useState } from "react";
// import { toast } from "sonner";
// import { TeacherPicker } from "./teacher-picker";
// import { BulkAssignSubjectsDialog } from "./bulk-assign-subjects-dialog.usecase";
// import { Button } from "@/components/ui/button";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import {
// 	useSubjects, useClassSubjects, useAssignSubject, useRemoveSubject,
// } from "../hooks/use-classes";
// import { Loader2, X, Users } from "lucide-react";
// import { ApiErrorResponse } from "@/types/api-response";

// export function SubjectTags({ classId, termId }: { classId: string; termId: string }) {
// 	const { data: allSubjects } = useSubjects();
// 	const { data: classSubjects } = useClassSubjects(classId, termId);
// 	const assignSubject = useAssignSubject(classId);
// 	const removeSubject = useRemoveSubject(classId);

// 	const [pickerOpen, setPickerOpen] = useState(false);
// 	const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
// 	const [selectedTeacherId, setSelectedTeacherId] = useState("");

// 	const [bulkOpen, setBulkOpen] = useState(false);

// 	function assignedFor(subjectId: string) {
// 		return classSubjects?.find((cs) => cs.subjectId === subjectId);
// 	}

// 	function openPicker(subjectId: string) {
// 		setActiveSubjectId(subjectId);
// 		setSelectedTeacherId("");
// 		setPickerOpen(true);
// 	}

// 	async function handleAssign() {
// 		if (!activeSubjectId || !selectedTeacherId || !termId) return;

// 		try {
// 			await assignSubject.mutateAsync({
// 				subjectId: activeSubjectId,
// 				staffId: selectedTeacherId,
// 				termId,
// 			});
// 			toast.success("Subject assigned");
// 			setPickerOpen(false);
// 		} catch (err) {
// 			const apiErr = err as ApiErrorResponse;
// 			toast.error(apiErr.message || "Couldn't assign subject");
// 		}
// 	}

// 	async function handleRemove(classSubjectId: string, e: React.MouseEvent) {
// 		e.stopPropagation();
// 		try {
// 			await removeSubject.mutateAsync(classSubjectId);
// 			toast.success("Subject removed");
// 		} catch (err) {
// 			const apiErr = err as ApiErrorResponse;
// 			toast.error(apiErr.message || "Couldn't remove subject");
// 		}
// 	}

// 	return (
// 		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
// 			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
// 				<div>
// 					<h3 className="font-medium">Subjects</h3>
// 					<p className="mt-1 text-xs text-muted-foreground">Click a subject to assign or reassign a teacher.</p>
// 				</div>

// 				{allSubjects && allSubjects.length > 0 && (
// 					<Button variant="outline" size="sm" className="w-full gap-1.5 sm:w-auto" onClick={() => setBulkOpen(true)}>
// 						<Users className="size-3.5" /> Bulk assign
// 					</Button>
// 				)}
// 			</div>

// 			<div className="mt-4 flex flex-wrap gap-2">
// 				{allSubjects?.map((subject) => {
// 					const assignment = assignedFor(subject.id);

// 					return (
// 						<button
// 							key={subject.id}
// 							onClick={() => openPicker(subject.id)}
// 							className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
// 								assignment
// 									? "border-primary/40 bg-primary/10 text-primary"
// 									: "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
// 							}`}
// 						>
// 							{subject.name}
// 							{assignment && (
// 								<>
// 									<span className="text-xs opacity-70">— {assignment.staffName ?? "Assigned"}</span>
// 									<X
// 										className="size-3 opacity-70 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
// 										onClick={(e) => handleRemove(assignment.id, e)}
// 									/>
// 								</>
// 							)}
// 						</button>
// 					);
// 				})}
// 			</div>

// 			<Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
// 				<DialogContent>
// 					<DialogHeader><DialogTitle>Assign teacher</DialogTitle></DialogHeader>
// 					<TeacherPicker value={selectedTeacherId} onChange={(id) => setSelectedTeacherId(id)} />
// 					<DialogFooter>
// 						<Button onClick={handleAssign} disabled={!selectedTeacherId || assignSubject.isPending}>
// 							{assignSubject.isPending && <Loader2 className="size-4 animate-spin" />}
// 							Assign
// 						</Button>
// 					</DialogFooter>
// 				</DialogContent>
// 			</Dialog>

// 			<BulkAssignSubjectsDialog classId={classId} open={bulkOpen} onOpenChange={setBulkOpen} />
// 		</div>
// 	);
// }
