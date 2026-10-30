"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { schoolManagementApi } from "../services/school-management.api";
import { createSchoolSchema, CreateSchoolFormValues } from "../schemas/create-school.schema";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorResponse } from "@/types/api-response";

export function CreateSchoolDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const queryClient = useQueryClient();
	const {
		register, handleSubmit, setValue, watch, reset,
		formState: { errors, isSubmitting },
	} = useForm<CreateSchoolFormValues>({ resolver: zodResolver(createSchoolSchema) });

	const values = watch();

	async function onSubmit(formValues: CreateSchoolFormValues) {
		try {
			const res = await schoolManagementApi.create(formValues);
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			toast.success(`${formValues.name} created`);
			queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] });
			reset();
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't create school");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader><DialogTitle>Create school</DialogTitle></DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-1.5 sm:col-span-2">
						<Label htmlFor="name">School name</Label>
						<Input id="name" {...register("name")} />
						{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
					</div>

					<div className="space-y-1.5 sm:col-span-2">
						<Label htmlFor="subdomain">Subdomain</Label>
						<Input id="subdomain" {...register("subdomain")} placeholder="e.g. greenfield" />
						{errors.subdomain && <p className="text-xs text-destructive">{errors.subdomain.message}</p>}
					</div>

					<div className="space-y-1.5 sm:col-span-2">
						<Label htmlFor="email">School email</Label>
						<Input id="email" type="email" {...register("email")} />
						{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="phone">Phone (optional)</Label>
						<Input id="phone" {...register("phone")} />
					</div>

					<div className="space-y-1.5">
						<Label>Category</Label>
						<Select value={values.schoolCategory ?? ""} onValueChange={(v) => setValue("schoolCategory", v as CreateSchoolFormValues["schoolCategory"], { shouldValidate: true })}>
							<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="primary">Primary</SelectItem>
								<SelectItem value="secondary">Secondary</SelectItem>
								<SelectItem value="primary_secondary">Primary & Secondary</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-1.5 sm:col-span-2">
						<Label>Ownership</Label>
						<Select value={values.schoolOwnership ?? ""} onValueChange={(v) => setValue("schoolOwnership", v as CreateSchoolFormValues["schoolOwnership"], { shouldValidate: true })}>
							<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="private">Private</SelectItem>
								<SelectItem value="public">Public</SelectItem>
								<SelectItem value="mission">Mission</SelectItem>
								<SelectItem value="international">International</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className="sm:col-span-2">
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							Create school
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}