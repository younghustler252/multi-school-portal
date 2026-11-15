"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePublicPlans } from "@/features/plans/hooks/use-plans";
import { LIMIT_KEYS, capacityLabel } from "@/features/plans/lib/plan-entitlements";
import { formatNaira } from "@/lib/format-money";
import { isApiError } from "@/lib/api/api-error";
import { useChangePlan, usePlanChangePreview, useRequestDowngrade } from "../hooks/use-billing";
import { classifyChange, isCredit, priceFor } from "../lib/plan-change";
import type { BillingCycle, BillingSummary } from "../types/billing.types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

interface Props {
	summary: BillingSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ChangePlanDialog({ summary, open, onOpenChange }: Props) {
	const { data: plans } = usePublicPlans();
	const changePlan = useChangePlan();
	const requestDowngrade = useRequestDowngrade();
	const { subscription, plan: currentPlan } = summary;

	const [cycle, setCycle] = useState<BillingCycle>(subscription.billingCycle);
	const [planId, setPlanId] = useState<string | null>(null);
	const [coupon, setCoupon] = useState("");
	const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
	const [autoRenew, setAutoRenew] = useState(true);
	const [redirecting, setRedirecting] = useState(false);

	// Public plans only. A lapsed school returns to its former plan through this list as long as that plan is public.
	const choices = plans ?? [];

	const selected = choices.find((p) => p.id === planId) ?? null;
	const kind = selected ? classifyChange({ plan: currentPlan, cycle: subscription.billingCycle, status: subscription.status }, selected, cycle) : null;

	useEffect(() => { if (!open) { setPlanId(null); setCoupon(""); setAppliedCoupon(undefined); setRedirecting(false); } }, [open]);

	const preview = usePlanChangePreview(selected && kind === "upgrade" ? { planId: selected.id, billingCycle: cycle, couponCode: appliedCoupon } : null);
	const couponError = isApiError(preview.error) && preview.error.code === "COUPON_INVALID" ? preview.error.message : null;
	const previewError = preview.error && !couponError ? (preview.error as Error).message : null;

	async function confirmUpgrade() {
		if (!selected) return;
		try {
			const result = await changePlan.mutateAsync({ planId: selected.id, billingCycle: cycle, couponCode: appliedCoupon, autoRenew });
			if (result.status === "applied") {
				toast.success("Plan updated");
				onOpenChange(false);
				return;
			}
			setRedirecting(true);
			window.location.href = result.authorizationUrl;
		} catch (err) {
			toast.error((err as Error).message || "Couldn't start the plan change");
		}
	}

	async function confirmDowngrade() {
		if (!selected) return;
		try {
			const result = await requestDowngrade.mutateAsync(selected.id);
			toast.success(`You'll move to ${result.toPlan} on ${day(result.effectiveAt)}`);
			onOpenChange(false);
		} catch (err) {
			toast.error((err as Error).message || "Couldn't schedule the downgrade");
		}
	}

	const busy = changePlan.isPending || requestDowngrade.isPending || redirecting;

	return (
		<Dialog open={open} onOpenChange={(v) => { if (!redirecting) onOpenChange(v); }}>
			<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Change plan</DialogTitle>
					<DialogDescription>Upgrades are charged now. Moving to a cheaper plan takes effect at the end of your current billing period.</DialogDescription>
				</DialogHeader>

				<div className="flex justify-center gap-2">
					{(["monthly", "yearly"] as const).map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setCycle(c)}
							className={`rounded-full border px-4 py-1.5 text-sm capitalize ${cycle === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
						>
							{c}
						</button>
					))}
				</div>

				<div className="grid gap-3 sm:grid-cols-2">
					{choices.map((p) => {
						const k = classifyChange({ plan: currentPlan, cycle: subscription.billingCycle, status: subscription.status }, p, cycle);
						const price = priceFor(p, cycle);
						const isSelected = p.id === planId;
						const students = capacityLabel(p, LIMIT_KEYS.students, "students");
						return (
							<button
								key={p.id}
								type="button"
								disabled={k === "same"}
								onClick={() => setPlanId(p.id)}
								className={`rounded-xl border p-4 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border"} ${k === "same" ? "opacity-50" : "hover:border-primary/40"}`}
							>
								<div className="flex items-center justify-between">
									<span className="font-semibold">{p.name}</span>
									{k === "same" && <Check className="size-4 text-primary" />}
								</div>
								<div className="mt-1 text-lg font-semibold">
									{price === 0 ? "₦0" : formatNaira(price)}
									<span className="text-xs font-normal text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>
								</div>
								{students && <div className="mt-1 text-xs text-muted-foreground">{students}</div>}
								<div className="mt-1 text-xs text-muted-foreground">
									{k === "same" ? "Current plan" : k === "downgrade" ? "Takes effect at period end" : "Charged now"}
								</div>
							</button>
						);
					})}
				</div>

				{selected && kind === "upgrade" && (
					<div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
						<form
							className="flex items-end gap-2"
							onSubmit={(e) => { e.preventDefault(); setAppliedCoupon(coupon.trim() || undefined); }}
						>
							<div className="flex-1 space-y-1.5">
								<Label htmlFor="coupon">Coupon code (optional)</Label>
								<Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={40} />
							</div>
							<Button type="submit" variant="outline" disabled={!coupon.trim()}>Apply</Button>
						</form>
						{couponError && <p className="text-xs text-destructive">{couponError}</p>}
						{preview.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Working out the price…</div>}
						{previewError && <p className="text-destructive">{previewError}</p>}
						{preview.data && !couponError && (
							<>
								<ul className="space-y-1">
									{preview.data.items.map((item, i) => (
										<li key={i} className="flex justify-between gap-4">
											<span className="text-muted-foreground">{item.description}</span>
											<span className={isCredit(item.kind) ? "text-success" : ""}>{formatNaira(item.amountKobo)}</span>
										</li>
									))}
								</ul>
								<div className="flex justify-between border-t border-border pt-2 font-semibold">
									<span>Due today</span>
									<span>{formatNaira(preview.data.totalKobo)}</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{preview.data.keepsRenewalDate
										? `Your renewal date stays ${day(preview.data.newPeriodEnd)}.`
										: `A new billing period starts today and runs to ${day(preview.data.newPeriodEnd)}.`}
								</p>
								{preview.data.totalKobo > 0 && (
									<div className="flex items-center justify-between gap-3">
										<Label htmlFor="auto-renew" className="text-sm font-normal">Renew automatically with the card I pay with</Label>
										<Switch id="auto-renew" checked={autoRenew} onCheckedChange={setAutoRenew} />
									</div>
								)}
							</>
						)}
					</div>
				)}

				{selected && kind === "downgrade" && (
					<p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
						You keep {currentPlan.name} until {day(subscription.currentPeriodEnd)}, then move to {selected.name}. If your school is over {selected.name}&apos;s limits by then, the change is cancelled and you stay on {currentPlan.name}.
					</p>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
					{kind === "downgrade" ? (
						<Button onClick={confirmDowngrade} disabled={busy}>
							{requestDowngrade.isPending && <Loader2 className="size-4 animate-spin" />} Schedule downgrade
						</Button>
					) : (
						<Button onClick={confirmUpgrade} disabled={!selected || kind !== "upgrade" || !preview.data || !!couponError || busy}>
							{busy && <Loader2 className="size-4 animate-spin" />}
							{redirecting ? "Redirecting…" : preview.data && preview.data.totalKobo === 0 ? "Confirm change" : "Continue to payment"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
