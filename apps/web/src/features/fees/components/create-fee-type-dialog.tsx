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
import { useCreateFeeType } from "../hooks/use-fees";
import { createFeeTypeSchema, CreateFeeTypeFormValues } from "../schemas/fee.schema";
import { ApiErrorResponse } from "@/types/api-response";

interface CreateFeeTypeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateFeeTypeDialog({ open, onOpenChange }: CreateFeeTypeDialogProps) {
	const createFeeType = useCreateFeeType();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CreateFeeTypeFormValues>({
		resolver: zodResolver(createFeeTypeSchema),
	});

	async function onSubmit(values: CreateFeeTypeFormValues) {
		try {
			await createFeeType.mutateAsync(values);
			toast.success(`${values.name} fee type created`);
			reset();
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't create fee type");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add fee type</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="name">Name</Label>
						<Input id="name" {...register("name")} placeholder="e.g. Tuition, Development Levy" />
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="description">Description (optional)</Label>
						<Input id="description" {...register("description")} />
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Creating…" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}