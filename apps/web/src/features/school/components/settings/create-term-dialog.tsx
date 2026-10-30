"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useCreateTerm } from "@/features/school/hooks/use-sessions";
import { createTermSchema, CreateTermFormValues } from "@/features/school/schemas/session.schema";
import { TERM_LABELS } from "../term-badge";
import { ApiErrorResponse } from "@/types/api-response";

interface CreateTermDialogProps {
	sessionId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateTermDialog({ sessionId, open, onOpenChange }: CreateTermDialogProps) {
	const createTerm = useCreateTerm();

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CreateTermFormValues>({
		resolver: zodResolver(createTermSchema),
		defaultValues: { sessionId },
	});

	const values = watch();

	async function onSubmit(formValues: CreateTermFormValues) {
		try {
			await createTerm.mutateAsync(formValues);
			toast.success(`${TERM_LABELS[formValues.name]} created`);
			reset({ sessionId });
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't create term");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add term</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label>Term</Label>
						<Select
							value={values.name ?? ""}
							onValueChange={(v) => setValue("name", v as CreateTermFormValues["name"], { shouldValidate: true })}
						>
							<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
							<SelectContent>
								{Object.entries(TERM_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>{label}</SelectItem>
								))}
							</SelectContent>
						</Select>
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
							{isSubmitting ? "Creating…" : "Create term"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}