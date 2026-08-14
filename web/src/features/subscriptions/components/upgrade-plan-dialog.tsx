"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { useUpgradePlan } from "../hooks/use-subscription";
import { formatNaira } from "@/lib/format-money";
import { BillingCycle } from "../types/subscription.types";
import { ApiErrorResponse } from "@/types/api-response";

interface UpgradePlanDialogProps {
	currentPlanId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function UpgradePlanDialog({ currentPlanId, open, onOpenChange }: UpgradePlanDialogProps) {
	const { data: plans } = usePlans();
	const upgradePlan = useUpgradePlan();
	const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
	const [cycle, setCycle] = useState<BillingCycle>("monthly");

	async function handleUpgrade() {
		if (!selectedPlanId) return;
		try {
			await upgradePlan.mutateAsync({ planId: selectedPlanId, billingCycle: cycle });
			toast.success("Plan updated");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update plan");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Change plan</DialogTitle>
					<DialogDescription>Select a plan and billing cycle.</DialogDescription>
				</DialogHeader>

				<div className="flex justify-center gap-2">
					{(["monthly", "yearly"] as const).map((c) => (
						<button
							key={c}
							onClick={() => setCycle(c)}
							className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
								cycle === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
							}`}
						>
							{c}
						</button>
					))}
				</div>

				<div className="grid gap-3 sm:grid-cols-2">
					{plans?.map((plan) => {
						const isCurrent = plan.id === currentPlanId;
						const isSelected = plan.id === selectedPlanId;
						const price = cycle === "monthly" ? plan.monthlyPriceKobo : plan.yearlyPriceKobo;
						return (
							<button
								key={plan.id}
								onClick={() => !isCurrent && setSelectedPlanId(plan.id)}
								disabled={isCurrent}
								className={`rounded-xl border p-4 text-left transition-colors ${
									isSelected ? "border-primary bg-primary/5" : "border-border"
								} ${isCurrent ? "opacity-50" : "hover:border-primary/40"}`}
							>
								<div className="flex items-center justify-between">
									<span className="font-semibold">{plan.name}</span>
									{isCurrent && <Check className="size-4 text-primary" />}
								</div>
								<div className="mt-1 text-lg font-semibold">
									{price === 0 ? "₦0" : formatNaira(price)}
									<span className="text-xs font-normal text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>
								</div>
								{isCurrent && <div className="mt-1 text-xs text-muted-foreground">Current plan</div>}
							</button>
						);
					})}
				</div>

				<DialogFooter>
					<Button
						onClick={handleUpgrade}
						disabled={!selectedPlanId || upgradePlan.isPending}
					>
						{upgradePlan.isPending && <Loader2 className="size-4 animate-spin" />}
						{upgradePlan.isPending ? "Updating…" : "Confirm plan change"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}