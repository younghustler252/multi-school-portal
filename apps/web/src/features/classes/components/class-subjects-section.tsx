"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserRoundCheck, Loader2, X, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { TeacherPicker } from "./teacher-picker";
import { BulkAssignSubjectsDialog } from "./bulk-assign-subjects-dialog";
import {
	useClassSubjects, useAssignSubject, useClearSubjectOverride, useRemoveSubject,
} from "../hooks/use-classes";
import { EnrichedClassSubject } from "../types/class.types";
import { ApiErrorResponse } from "@/types/api-response";

const SOURCE_LABEL: Record<string, string> = {
	auto_subject_default: "subject default",
	auto_homeroom: "homeroom default",
};

const COLLAPSED_COUNT = 6;

interface ClassSubjectsSectionProps {
	classId: string;
	termId: string | undefined;
}

export function ClassSubjectsSection({ classId, termId }: ClassSubjectsSectionProps) {
	const { data: classSubjects, isLoading } = useClassSubjects(classId, termId);
	const assignSubject = useAssignSubject();
	const clearOverride = useClearSubjectOverride(classId);
	const removeSubject = useRemoveSubject(classId);

	const [expanded, setExpanded] = useState(false);
	const [pickerTarget, setPickerTarget] = useState<EnrichedClassSubject | null>(null);
	const [pickerTeacherId, setPickerTeacherId] = useState("");
	const [removeTarget, setRemoveTarget] = useState<EnrichedClassSubject | null>(null);
	const [bulkOpen, setBulkOpen] = useState(false);

	function openPicker(row: EnrichedClassSubject) {
		setPickerTarget(row);
		setPickerTeacherId(row.staffId ?? "");
	}

	async function handleAssign() {
		if (!pickerTarget || !pickerTeacherId || !termId) return;
		try {
			await assignSubject.mutateAsync({
				classId,
				data: { subjectId: pickerTarget.subjectId, staffId: pickerTeacherId, termId },
			});
			toast.success(`${pickerTarget.subjectName} assigned`);
			setPickerTarget(null);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't assign subject");
		}
	}

	async function handleClearOverride(row: EnrichedClassSubject, e: React.MouseEvent) {
		e.stopPropagation();
		if (!row.classSubjectId) return;
		try {
			await clearOverride.mutateAsync(row.classSubjectId);
			toast.success(`${row.subjectName} reset to automatic assignment`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't reset assignment");
		}
	}

	async function handleRemove() {
		if (!removeTarget?.classSubjectId) return;
		try {
			await removeSubject.mutateAsync(removeTarget.classSubjectId);
			toast.success(`${removeTarget.subjectName} removed from this class`);
			setRemoveTarget(null);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't remove subject");
		}
	}

	if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;

	const rows = classSubjects ?? [];
	const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);
	const hiddenCount = rows.length - visibleRows.length;

	return (
		<div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 className="font-medium">Subjects</h3>
					<p className="mt-0.5 text-xs text-muted-foreground">Tap a subject to assign or change its teacher.</p>
				</div>
				<Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
					<UserRoundCheck className="size-3.5" /> Bulk assign
				</Button>
			</div>

			<div className="mt-4 flex flex-wrap gap-2">
				{visibleRows.map((row) => {
					const sourceLabel = row.assignedVia ? SOURCE_LABEL[row.assignedVia] : null;
					const isUnassigned = !row.staffId;
					const isManual = row.assignedVia === "manual";

					return (
						<button
							key={row.subjectId}
							onClick={() => openPicker(row)}
							className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
								isUnassigned
									? "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
									: "border-primary/30 bg-primary/5 text-foreground hover:border-primary/50"
							}`}
						>
							<span className="font-medium">{row.subjectName}</span>
							{!isUnassigned && (
								<span className="text-xs text-muted-foreground">
									— {row.teacherName}
									{sourceLabel && <span className="opacity-70"> ({sourceLabel})</span>}
								</span>
							)}
							{!isUnassigned && (
								<span className="ml-0.5 flex items-center gap-0.5">
									{isManual && (
										<X
											className="size-3 opacity-0 transition-opacity group-hover:opacity-100"
											onClick={(e) => { e.stopPropagation(); setRemoveTarget(row); }}
										/>
									)}
									{isManual ? null : (
										<span title="Automatic assignment">
											<RotateCcw className="size-3 opacity-0" />
										</span>
									)}
								</span>
							)}
						</button>
					);
				})}

				{hiddenCount > 0 && (
					<button
						onClick={() => setExpanded(true)}
						className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
					>
						+{hiddenCount} more <ChevronDown className="size-3" />
					</button>
				)}
				{expanded && rows.length > COLLAPSED_COUNT && (
					<button
						onClick={() => setExpanded(false)}
						className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
					>
						Show less
					</button>
				)}
			</div>

			<Dialog open={!!pickerTarget} onOpenChange={(open) => !open && setPickerTarget(null)}>
				<DialogContent>
					<DialogHeader><DialogTitle>{pickerTarget?.subjectName}</DialogTitle></DialogHeader>
					{pickerTarget?.assignedVia && pickerTarget.assignedVia !== "manual" && (
						<div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
							<span>Currently following the {SOURCE_LABEL[pickerTarget.assignedVia]}</span>
						</div>
					)}
					<TeacherPicker value={pickerTeacherId} onChange={setPickerTeacherId} />
					<DialogFooter className="flex-row justify-between sm:justify-between">
						{pickerTarget?.assignedVia === "manual" && pickerTarget.classSubjectId && (
							<Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={(e) => { handleClearOverride(pickerTarget, e); setPickerTarget(null); }}>
								<RotateCcw className="size-3.5" /> Reset to automatic
							</Button>
						)}
						<Button onClick={handleAssign} disabled={!pickerTeacherId || assignSubject.isPending} className="ml-auto">
							{assignSubject.isPending && <Loader2 className="size-4 animate-spin" />}
							Assign
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={!!removeTarget}
				onOpenChange={(open) => !open && setRemoveTarget(null)}
				title={`Remove ${removeTarget?.subjectName}?`}
				description="This removes the subject from this class entirely."
				confirmLabel="Remove"
				destructive
				isLoading={removeSubject.isPending}
				onConfirm={handleRemove}
			/>

			{termId && (
				<BulkAssignSubjectsDialog classId={classId} termId={termId} open={bulkOpen} onOpenChange={setBulkOpen} />
			)}
		</div>
	);
}