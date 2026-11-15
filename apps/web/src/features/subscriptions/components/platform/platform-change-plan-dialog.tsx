"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminPlans } from "@/features/plans/hooks/use-plan-admin";
import { formatNaira } from "@/lib/format-money";
import { usePlatformChangePlan } from "../../hooks/use-platform-billing";
import { buildPlanChange, periodEndProblem, reasonProblem } from "../../lib/platform-billing";
import type { BillingCycle } from "../../types/billing.types";

interface Props {
	schoolId: string;
	currentPlanId?: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** Gives a school a plan with no payment (support or sales). It is recorded as a zero-value invoice with the reason. */
export function PlatformChangePlanDialog({ schoolId, currentPlanId, open, onOpenChange }: Props) {
	const { data: allPlans } = useAdminPlans(open);
	const plans = (allPlans ?? []).filter((p) => p.isActive);
	const change = usePlatformChangePlan();
	const [planId, setPlanId] = useState("");
	const [cycle, setCycle] = useState<BillingCycle>("monthly");
	const [periodEnd, setPeriodEnd] = useState("");
	const [reason, setReason] = useState("");
	const [touched, setTouched] = useState(false);

	useEffect(() => {
		if (open) { setPlanId(currentPlanId ?? ""); setCycle("monthly"); setPeriodEnd(""); setReason(""); setTouched(false); }
	}, [open, currentPlanId]);

	const selected = plans.find((p) => p.id === planId);
	const isFree = !!selected?.isFree;
	const problem = !planId ? "Choose a plan." : periodEndProblem(isFree ? "" : periodEnd) ?? reasonProblem(reason);

	async function submit() {
		setTouched(true);
		if (problem) return;
		try {
			await change.mutateAsync({ schoolId, ...buildPlanChange({ planId, billingCycle: cycle, periodEnd: isFree ? "" : periodEnd, reason }) });
			toast.success("Plan updated");
			onOpenChange(false);
		} catch (err) {
			toast.error((err as Error).message || "Couldn't change the plan");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Change plan</DialogTitle>
					<DialogDescription>This switches the school's plan directly. No payment is collected; after the period below the school is invoiced the plan's normal price.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label>Plan</Label>
						<Select value={planId} onValueChange={(v) => setPlanId(v ?? "")}>
							<SelectTrigger>
								<SelectValue placeholder="Select a plan">{(v: string | null) => plans.find((p) => p.id === v)?.name ?? "Select a plan"}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatNaira(p.monthlyPriceKobo)}/mo</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
					{!isFree && (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label>Billing cycle</Label>
								<Select value={cycle} onValueChange={(v) => setCycle((v as BillingCycle) ?? "monthly")}>
									<SelectTrigger><SelectValue>{(v: string | null) => (v === "yearly" ? "Yearly" : "Monthly")}</SelectValue></SelectTrigger>
									<SelectContent>
										<SelectItem value="monthly">Monthly</SelectItem>
										<SelectItem value="yearly">Yearly</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="period-end">Complimentary until (optional)</Label>
								<Input id="period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
							</div>
						</div>
					)}
					<div className="space-y-1.5">
						<Label htmlFor="change-reason">Reason</Label>
						<Textarea id="change-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
						<p className="text-xs text-muted-foreground">At least 10 characters. Kept in the school's billing history.</p>
					</div>
					{touched && problem && <p className="text-sm text-destructive">{problem}</p>}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={submit} disabled={change.isPending}>
						{change.isPending && <Loader2 className="size-4 animate-spin" />}
						Change plan
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
