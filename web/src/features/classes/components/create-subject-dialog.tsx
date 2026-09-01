"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreateSubject } from "../hooks/use-classes";
import { createSubjectSchema, CreateSubjectFormValues } from "../schemas/class.schema";
import { ApiErrorResponse } from "@/types/api-response";

export function CreateSubjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const createSubject = useCreateSubject();
	const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateSubjectFormValues>({
		resolver: zodResolver(createSubjectSchema),
	});

	async function onSubmit(values: CreateSubjectFormValues) {
		try {
			await createSubject.mutateAsync(values);
			toast.success(`${values.name} created`);
			reset();
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't create subject");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader><DialogTitle>Add subject</DialogTitle></DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="name">Subject name</Label>
						<Input id="name" {...register("name")} />
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="code">Code (optional)</Label>
						<Input id="code" {...register("code")} placeholder="e.g. MTH101" />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="description">Description (optional)</Label>
						<Input id="description" {...register("description")} />
					</div>
					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							Create
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}