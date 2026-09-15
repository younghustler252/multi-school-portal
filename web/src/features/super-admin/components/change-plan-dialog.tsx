"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useChangeSchoolPlan } from "../hooks/use-school-management";
import { formatNaira } from "@/lib/format-money";
import { PlanResponseData } from "@/features/plans/types/plan.types";
import { ApiErrorResponse } from "@/types/api-response";

interface ChangePlanDialogProps {
	schoolId: string;
	currentPlanId?: string | null;
	plans: PlanResponseData[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ChangePlanDialog({ schoolId, currentPlanId, plans, open, onOpenChange }: ChangePlanDialogProps) {
	const changePlan = useChangeSchoolPlan();
	const [planId, setPlanId] = useState(currentPlanId ?? "");

	async function handleConfirm() {
		if (!planId) return;
		try {
			await changePlan.mutateAsync({ id: schoolId, planId });
			toast.success("Plan updated");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't change plan");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Change plan</DialogTitle>
					<DialogDescription>This switches the school's plan directly — no payment is collected here.</DialogDescription>
				</DialogHeader>

				<Select value={planId} onValueChange={(v) => setPlanId(v ?? "")}>
					<SelectTrigger>
						<SelectValue placeholder="Select a plan">
							{(v: string | null) => plans.find((p) => p.id === v)?.name ?? "Select a plan"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{plans.map((p) => (
							<SelectItem key={p.id} value={p.id}>
								{p.name} · {formatNaira(p.monthlyPriceKobo)}/mo
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={handleConfirm} disabled={!planId || changePlan.isPending}>
						{changePlan.isPending && <Loader2 className="size-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}