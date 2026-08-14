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
import { useCreateSession } from "@/features/school/hooks/use-sessions";
import { createSessionSchema, CreateSessionFormValues } from "@/features/school/schemas/session.schema";
import { ApiErrorResponse } from "@/types/api-response";

interface CreateSessionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateSessionDialog({ open, onOpenChange }: CreateSessionDialogProps) {
	const createSession = useCreateSession();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CreateSessionFormValues>({
		resolver: zodResolver(createSessionSchema),
	});

	async function onSubmit(values: CreateSessionFormValues) {
		try {
			await createSession.mutateAsync(values);
			toast.success(`Session ${values.name} created`);
			reset();
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't create session");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add academic session</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="name">Session name</Label>
						<Input id="name" {...register("name")} placeholder="e.g. 2024/2025" />
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="startDate">Start date</Label>
							<Input id="startDate" type="date" {...register("startDate")} />
							{errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="endDate">End date</Label>
							<Input id="endDate" type="date" {...register("endDate")} />
							{errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
						</div>
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Creating…" : "Create session"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}