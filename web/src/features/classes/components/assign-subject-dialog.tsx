"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useAssignSubject, useSubjects } from "@/features/classes/hooks/use-classes";
import { useStaffList } from "@/features/staff/hooks/use-staff";
import { assignSubjectSchema, AssignSubjectFormValues } from "@/features/classes/schemas/class.schema";
import { ApiErrorResponse } from "@/types/api-response";

interface AssignSubjectDialogProps {
	classId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AssignSubjectDialog({ classId, open, onOpenChange }: AssignSubjectDialogProps) {
	const assignSubject = useAssignSubject(classId);
	const { data: subjects } = useSubjects();
	const { data: staffData } = useStaffList({ role: "teacher", limit: 100 });

	const {
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<AssignSubjectFormValues>({
		resolver: zodResolver(assignSubjectSchema),
	});

	const values = watch();

	async function onSubmit(formValues: AssignSubjectFormValues) {
		try {
			await assignSubject.mutateAsync(formValues);
			toast.success("Subject assigned");
			reset();
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't assign subject");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Assign subject</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label>Subject</Label>
						<Select
							value={values.subjectId ?? ""}
							onValueChange={(v) => setValue("subjectId", v, { shouldValidate: true })}
						>
							<SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
							<SelectContent>
								{subjects?.map((s) => (
									<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
								))}
							</SelectContent>
						</Select>
						{errors.subjectId && <p className="text-xs text-destructive">{errors.subjectId.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label>Teacher</Label>
						<Select
							value={values.staffId ?? ""}
							onValueChange={(v) => setValue("staffId", v, { shouldValidate: true })}
						>
							<SelectTrigger><SelectValue placeholder="Select a teacher" /></SelectTrigger>
							<SelectContent>
								{staffData?.staff.map((s) => (
									<SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
								))}
							</SelectContent>
						</Select>
						{errors.staffId && <p className="text-xs text-destructive">{errors.staffId.message}</p>}
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Assigning…" : "Assign"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}