"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useCreatePlan, useUpdatePlan } from "../hooks/use-plan-management";
import { planFormSchema, PlanFormValues, featureKeys } from "../schemas/plan-management.schema";
import { FEATURE_LABELS } from "../constants/feature-labels";
import { PlanResponseData } from "../types/plan.types";
import { ApiErrorResponse } from "@/types/api-response";

interface PlanFormDialogProps {
	plan?: PlanResponseData; // present = edit mode
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const DEFAULT_FEATURES = Object.fromEntries(featureKeys.map((k) => [k, false])) as Record<(typeof featureKeys)[number], boolean>;

export function PlanFormDialog({ plan, open, onOpenChange }: PlanFormDialogProps) {
	const createPlan = useCreatePlan();
	const updatePlan = useUpdatePlan(plan?.id ?? "");
	const isEdit = !!plan;

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<PlanFormValues>({
		resolver: zodResolver(planFormSchema),
		defaultValues: {
			isPublic: true,
			features: DEFAULT_FEATURES,
		},
	});

	useEffect(() => {
		if (open) {
			if (plan) {
				reset({
					name: plan.name,
					description: plan.description ?? "",
					studentLimit: String(plan.studentLimit),
					staffLimit: String(plan.staffLimit),
					monthlyPriceKobo: String(plan.monthlyPriceKobo / 100),
					yearlyPriceKobo: String(plan.yearlyPriceKobo / 100),
					setupFeeKobo: String(plan.setupFeeKobo / 100),
					isPublic: plan.isPublic,
					features: { ...DEFAULT_FEATURES, ...plan.features },
				});
			} else {
				reset({ isPublic: true, features: DEFAULT_FEATURES });
			}
		}
	}, [open, plan, reset]);

	const values = watch();

	async function onSubmit(formValues: PlanFormValues) {
		const payload = {
			name: formValues.name,
			description: formValues.description || undefined,
			studentLimit: Number(formValues.studentLimit),
			staffLimit: Number(formValues.staffLimit),
			monthlyPriceKobo: Math.round(Number(formValues.monthlyPriceKobo) * 100),
			yearlyPriceKobo: Math.round(Number(formValues.yearlyPriceKobo) * 100),
			setupFeeKobo: formValues.setupFeeKobo ? Math.round(Number(formValues.setupFeeKobo) * 100) : 0,
			isPublic: formValues.isPublic,
			features: formValues.features,
		};

		try {
			if (isEdit) {
				await updatePlan.mutateAsync(payload);
				toast.success("Plan updated");
			} else {
				await createPlan.mutateAsync(payload);
				toast.success("Plan created");
			}
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save plan");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{isEdit ? `Edit ${plan?.name}` : "Create plan"}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5 sm:col-span-2">
							<Label htmlFor="name">Plan name</Label>
							<Input id="name" {...register("name")} />
							{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
						</div>
						<div className="space-y-1.5 sm:col-span-2">
							<Label htmlFor="description">Description</Label>
							<Input id="description" {...register("description")} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="studentLimit">Student limit</Label>
							<Input id="studentLimit" {...register("studentLimit")} placeholder="-1 for unlimited" />
							{errors.studentLimit && <p className="text-xs text-destructive">{errors.studentLimit.message}</p>}
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="staffLimit">Staff limit</Label>
							<Input id="staffLimit" {...register("staffLimit")} placeholder="-1 for unlimited" />
							{errors.staffLimit && <p className="text-xs text-destructive">{errors.staffLimit.message}</p>}
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="monthlyPriceKobo">Monthly price (₦)</Label>
							<Input id="monthlyPriceKobo" {...register("monthlyPriceKobo")} />
							{errors.monthlyPriceKobo && <p className="text-xs text-destructive">{errors.monthlyPriceKobo.message}</p>}
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="yearlyPriceKobo">Yearly price (₦)</Label>
							<Input id="yearlyPriceKobo" {...register("yearlyPriceKobo")} />
							{errors.yearlyPriceKobo && <p className="text-xs text-destructive">{errors.yearlyPriceKobo.message}</p>}
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="setupFeeKobo">Setup fee (₦, optional)</Label>
							<Input id="setupFeeKobo" {...register("setupFeeKobo")} />
						</div>
						<div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
							<Label htmlFor="isPublic" className="text-sm">Publicly visible</Label>
							<Switch
								id="isPublic"
								checked={values.isPublic}
								onCheckedChange={(v) => setValue("isPublic", v)}
							/>
						</div>
					</div>

					<div>
						<Label className="mb-2 block">Features</Label>
						<div className="grid gap-2 sm:grid-cols-2">
							{featureKeys.map((key) => (
								<label key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
									{FEATURE_LABELS[key]}
									<Switch
										checked={values.features?.[key] ?? false}
										onCheckedChange={(v) => setValue(`features.${key}`, v)}
									/>
								</label>
							))}
						</div>
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create plan"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}