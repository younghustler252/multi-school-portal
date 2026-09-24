"use client";

import { useState } from "react";
import { Loader2, UserCog, X, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TeacherPicker } from "./teacher-picker";
import { useSetSubjectDefaultTeacher } from "../hooks/use-classes";
import { useStaffList } from "@/features/staff/hooks/use-staff";
import { ApiErrorResponse } from "@/types/api-response";

interface DefaultTeacherCardProps {
	subjectId: string;
	defaultTeacherId: string | null;
}

export function DefaultTeacherCard({ subjectId, defaultTeacherId }: DefaultTeacherCardProps) {
	const setDefaultTeacher = useSetSubjectDefaultTeacher();
	const { data: staffData } = useStaffList({ limit: 200 });
	const [staffId, setStaffId] = useState(defaultTeacherId ?? "");
	const [editing, setEditing] = useState(false);

	const isDirty = staffId !== (defaultTeacherId ?? "");
	const currentTeacher = staffData?.staff.find((s) => s.id === defaultTeacherId);

	async function handleSave() {
		try {
			await setDefaultTeacher.mutateAsync({ subjectId, staffId: staffId || null });
			toast.success("Default teacher updated");
			setEditing(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update default teacher");
		}
	}

	async function handleClear() {
		try {
			await setDefaultTeacher.mutateAsync({ subjectId, staffId: null });
			setStaffId("");
			setEditing(false);
			toast.success("Default teacher cleared");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't clear default teacher");
		}
	}

	return (
		<div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6">
			<div className="flex items-start gap-3">
				<div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
					<UserCog className="size-4.5" />
				</div>
				<div>
					<h3 className="font-medium">Default teacher</h3>
					<p className="mt-0.5 text-xs text-muted-foreground">
						This subject will always default to this teacher in every class, regardless of your school's teaching model.
					</p>
				</div>
			</div>

			{!editing ? (
				<div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-border px-3.5 py-3">
					<div className="flex items-center gap-2.5 text-sm">
						<div className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
							<User className="size-4" />
						</div>
						{currentTeacher ? (
							<span className="font-medium">{currentTeacher.firstName} {currentTeacher.lastName}</span>
						) : (
							<span className="text-muted-foreground">No default teacher set</span>
						)}
					</div>
					<Button size="sm" variant="outline" onClick={() => { setStaffId(defaultTeacherId ?? ""); setEditing(true); }}>
						{currentTeacher ? "Change" : "Set"}
					</Button>
				</div>
			) : (
				<div className="mt-4 flex flex-col gap-2 sm:flex-row">
					<div className="flex-1">
						<TeacherPicker value={staffId} onChange={setStaffId} />
					</div>
					<div className="flex gap-2">
						<Button size="sm" onClick={handleSave} disabled={!isDirty || setDefaultTeacher.isPending} className="flex-1 sm:flex-initial">
							{setDefaultTeacher.isPending && <Loader2 className="size-3.5 animate-spin" />}
							Save
						</Button>
						{defaultTeacherId && (
							<Button size="sm" variant="outline" onClick={handleClear} disabled={setDefaultTeacher.isPending}>
								<X className="size-3.5" />
							</Button>
						)}
						<Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
							Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}