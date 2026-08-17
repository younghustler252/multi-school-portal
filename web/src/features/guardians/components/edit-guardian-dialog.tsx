"use client";

import { useEffect } from "react";
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
import { useUpdateGuardian } from "../hooks/use-guardians";
import { updateGuardianSchema, UpdateGuardianFormValues } from "../schemas/guardian.schema";
import { GuardianResponseData } from "../types/guardian.types";
import { ApiErrorResponse } from "@/types/api-response";

interface EditGuardianDialogProps {
	guardian: GuardianResponseData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditGuardianDialog({ guardian, open, onOpenChange }: EditGuardianDialogProps) {
	const updateGuardian = useUpdateGuardian(guardian.id);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<UpdateGuardianFormValues>({
		resolver: zodResolver(updateGuardianSchema),
	});

	useEffect(() => {
		if (open) {
			reset({
				firstName: guardian.firstName,
				lastName: guardian.lastName,
				email: guardian.email,
				phone: guardian.phone ?? "",
				occupation: guardian.occupation ?? "",
				address: guardian.address ?? "",
			});
		}
	}, [open, guardian, reset]);

	async function onSubmit(values: UpdateGuardianFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
			);
			await updateGuardian.mutateAsync(cleaned);
			toast.success("Guardian updated");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save changes");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit {guardian.firstName} {guardian.lastName}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-1.5">
						<Label htmlFor="firstName">First name</Label>
						<Input id="firstName" {...register("firstName")} />
						{errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="lastName">Last name</Label>
						<Input id="lastName" {...register("lastName")} />
						{errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
					</div>
					<div className="space-y-1.5 sm:col-span-2">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" {...register("email")} />
						{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="phone">Phone</Label>
						<Input id="phone" {...register("phone")} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="occupation">Occupation</Label>
						<Input id="occupation" {...register("occupation")} />
					</div>
					<div className="space-y-1.5 sm:col-span-2">
						<Label htmlFor="address">Address</Label>
						<Input id="address" {...register("address")} />
					</div>

					<DialogFooter className="sm:col-span-2">
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Saving…" : "Save changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}