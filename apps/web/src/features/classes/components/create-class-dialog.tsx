"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useCreateClass } from "@/features/classes/hooks/use-classes";
import { createClassSchema, CreateClassFormValues } from "@/features/classes/schemas/class.schema";
import { ApiErrorResponse } from "@/types/api-response";

interface CreateClassDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateClassDialog({ open, onOpenChange }: CreateClassDialogProps) {
	const createClass = useCreateClass();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CreateClassFormValues>({
		resolver: zodResolver(createClassSchema),
	});

	async function onSubmit(values: CreateClassFormValues) {
		try {
			await createClass.mutateAsync(values);
			toast.success(`${values.name} created`);
			reset();
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't create class");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add class</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="name">Class name</Label>
						<Input id="name" {...register("name")} placeholder="e.g. JSS 2A" />
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="level">Level</Label>
						<Input id="level" {...register("level")} placeholder="e.g. JSS2" />
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="capacity">Capacity</Label>
						<Input id="capacity" type="number" {...register("capacity")} placeholder="e.g. 35" />
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Creating…" : "Create class"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}