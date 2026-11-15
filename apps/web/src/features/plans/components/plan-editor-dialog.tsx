"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { planFormSchema, type PlanFormValues } from "../schemas/plan-management.schema";
import { useAdminPlan, useCreatePlan, useSetEntitlements, useUpdatePlan } from "../hooks/use-plan-admin";
import { draftFrom, draftProblem, entitlementChanges, koboToNaira, nairaToKobo, type DraftMap, type FeatureDraft } from "../lib/plan-admin";
import { PlanFeaturesEditor } from "./plan-features-editor";
import type { AdminPlan } from "../types/plan-admin.types";

interface PlanEditorDialogProps {
	/** null = create a new plan. */
	plan: AdminPlan | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	canManage: boolean;
}

const emptyForm: PlanFormValues = { name: "", description: "", monthlyPrice: "0", yearlyPrice: "0", setupFee: "", isPublic: true };

function formFrom(plan: AdminPlan | null): PlanFormValues {
	if (!plan) return emptyForm;
	return {
		name: plan.name,
		description: plan.description ?? "",
		monthlyPrice: koboToNaira(plan.monthlyPriceKobo),
		yearlyPrice: koboToNaira(plan.yearlyPriceKobo),
		setupFee: plan.setupFeeKobo ? koboToNaira(plan.setupFeeKobo) : "",
		isPublic: plan.isPublic,
	};
}

export function PlanEditorDialog({ plan, open, onOpenChange, canManage }: PlanEditorDialogProps) {
	const isEdit = !!plan;
	// The list has no entitlements; the single-plan read lists every feature, granted or not.
	const full = useAdminPlan(open && plan ? plan.id : null);
	const createPlan = useCreatePlan();
	const updatePlan = useUpdatePlan();
	const setEntitlements = useSetEntitlements();
	const [drafts, setDrafts] = useState<DraftMap>({});
	const features = useMemo(() => full.data?.entitlements ?? [], [full.data]);

	const form = useForm<PlanFormValues>({ resolver: zodResolver(planFormSchema), defaultValues: emptyForm });
	const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = form;

	useEffect(() => {
		if (open) reset(formFrom(plan));
	}, [open, plan, reset]);

	useEffect(() => {
		setDrafts(Object.fromEntries(features.map((f) => [f.key, draftFrom(f)])));
	}, [features]);

	const pending = createPlan.isPending || updatePlan.isPending || setEntitlements.isPending;
	const readOnly = !canManage;
	const priceLocked = !!plan?.isFree;

	async function onSubmit(values: PlanFormValues) {
		const monthlyPriceKobo = nairaToKobo(values.monthlyPrice)!;
		const yearlyPriceKobo = nairaToKobo(values.yearlyPrice)!;
		const setupFeeKobo = values.setupFee === "" ? 0 : nairaToKobo(values.setupFee)!;
		try {
			if (!plan) {
				await createPlan.mutateAsync({
					name: values.name, ...(values.description ? { description: values.description } : {}),
					monthlyPriceKobo, yearlyPriceKobo, ...(setupFeeKobo ? { setupFeeKobo } : {}), isPublic: values.isPublic,
				});
				toast.success(`${values.name} created. Open it to choose what it includes.`);
				onOpenChange(false);
				return;
			}
			const problem = draftProblem(features, drafts);
			if (problem) { toast.error(problem); return; }
			await updatePlan.mutateAsync({
				id: plan.id, name: values.name, description: values.description || null,
				...(priceLocked ? {} : { monthlyPriceKobo, yearlyPriceKobo }), setupFeeKobo, isPublic: values.isPublic,
			});
			const changes = entitlementChanges(features, drafts);
			if (changes.length) await setEntitlements.mutateAsync({ id: plan.id, changes });
			toast.success(`${values.name} saved`);
			onOpenChange(false);
		} catch (err) {
			toast.error((err as Error).message || "Couldn't save the plan");
		}
	}

	const setDraft = (key: string, next: FeatureDraft) => setDrafts((d) => ({ ...d, [key]: next }));

	const details = (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label htmlFor="plan-name">Name</Label>
				<Input id="plan-name" disabled={readOnly} aria-invalid={!!errors.name} {...register("name")} />
				{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="plan-description">Description</Label>
				<Textarea id="plan-description" rows={2} disabled={readOnly} {...register("description")} />
				{errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
			</div>
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="space-y-1.5">
					<Label htmlFor="plan-monthly">Monthly price (₦)</Label>
					<Input id="plan-monthly" inputMode="decimal" disabled={readOnly || priceLocked} {...register("monthlyPrice")} />
					{errors.monthlyPrice && <p className="text-xs text-destructive">{errors.monthlyPrice.message}</p>}
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="plan-yearly">Yearly price (₦)</Label>
					<Input id="plan-yearly" inputMode="decimal" disabled={readOnly || priceLocked} {...register("yearlyPrice")} />
					{errors.yearlyPrice && <p className="text-xs text-destructive">{errors.yearlyPrice.message}</p>}
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="plan-setup">Setup fee (₦)</Label>
					<Input id="plan-setup" inputMode="decimal" placeholder="0" disabled={readOnly} {...register("setupFee")} />
					{errors.setupFee && <p className="text-xs text-destructive">{errors.setupFee.message}</p>}
				</div>
			</div>
			{priceLocked && <p className="text-xs text-muted-foreground">The free plan's prices are fixed at ₦0.</p>}
			<label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
				<span>
					<span className="block text-sm font-medium">Listed on the pricing page</span>
					<span className="block text-xs text-muted-foreground">Turn off for a private plan you assign to a school yourself.</span>
				</span>
				<Switch disabled={readOnly} checked={watch("isPublic")} onCheckedChange={(v) => setValue("isPublic", v)} />
			</label>
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{isEdit ? (readOnly ? plan!.name : `Edit ${plan!.name}`) : "Create plan"}</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					{isEdit ? (
						<Tabs defaultValue="details">
							<TabsList>
								<TabsTrigger value="details">Details</TabsTrigger>
								<TabsTrigger value="features">Features</TabsTrigger>
							</TabsList>
							<TabsContent value="details" className="pt-4">{details}</TabsContent>
							<TabsContent value="features" className="pt-4">
								{full.isLoading ? (
									<div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
								) : full.isError ? (
									<p className="text-sm text-destructive">Couldn't load this plan's features. Close and try again.</p>
								) : (
									<PlanFeaturesEditor features={features} drafts={drafts} onChange={setDraft} disabled={readOnly} />
								)}
								{plan!.subscribers > 0 && !readOnly && (
									<p className="mt-3 text-xs text-muted-foreground">{plan!.subscribers} school{plan!.subscribers === 1 ? "" : "s"} use this plan, and feature changes apply to them straight away.</p>
								)}
							</TabsContent>
						</Tabs>
					) : (
						<>
							{details}
							<p className="text-xs text-muted-foreground">After creating the plan, open it to choose which features it includes.</p>
						</>
					)}
					<DialogFooter>
						<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{readOnly ? "Close" : "Cancel"}</Button>
						{!readOnly && (
							<Button type="submit" disabled={pending}>
								{pending && <Loader2 className="size-4 animate-spin" />}
								{isEdit ? "Save changes" : "Create plan"}
							</Button>
						)}
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
