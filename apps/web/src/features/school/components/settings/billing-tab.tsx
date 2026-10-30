"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { usePlans } from "@/features/plans/hooks/use-plans";
import {
	useMySubscription,
	useVerifyUpgrade,
	useToggleAutoRenew,
	useBillingHistory,
} from "@/features/subscriptions/hooks/use-subscription";
import { UpgradePlanDialog } from "@/features/subscriptions/components/upgrade-plan-dialog";
import { SettingsSection } from "./settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatNaira } from "@/lib/format-money";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types/api-response";

export function BillingTab() {
	const { data: plans, isLoading: plansLoading } = usePlans();
	const { data: subData, isLoading: subLoading } = useMySubscription();

	const verifyUpgrade = useVerifyUpgrade();
	const toggleAutoRenew = useToggleAutoRenew();
	const [upgradeOpen, setUpgradeOpen] = useState(false);
	const [autoRenewBlocked, setAutoRenewBlocked] = useState(false);

	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const reference = searchParams.get("reference") ?? searchParams.get("trxref");

	const [verifyState, setVerifyState] = useState<"idle" | "checking" | "success" | "failed">("idle");
	const hasVerified = useRef(false);

	useEffect(() => {
		if (!reference || hasVerified.current) return;
		hasVerified.current = true;
		setVerifyState("checking");

		verifyUpgrade.mutate(reference, {
			onSuccess: (result) => {
				setVerifyState(result.success ? "success" : "failed");
				stripReferenceFromUrl();
			},
			onError: (err) => {
				console.error(err.message || "Couldn't verify payment");
				setVerifyState("failed");
				stripReferenceFromUrl();
			},
		});

		function stripReferenceFromUrl() {
			const params = new URLSearchParams(searchParams.toString());
			params.delete("reference");
			params.delete("trxref");
			router.replace(`${pathname}?${params.toString()}`, { scroll: false });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reference]);

	async function handleAutoRenewChange(enabled: boolean) {
		try {
			await toggleAutoRenew.mutateAsync({ enabled });
			setAutoRenewBlocked(false);
			toast.success(enabled ? "Auto-renew turned on" : "Auto-renew turned off");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			if (apiErr.code === "AUTO_RENEW_REQUIRES_CARD_PAYMENT") {
				setAutoRenewBlocked(true);
			} else {
				toast.error(apiErr.message || "Couldn't update auto-renew");
			}
		}
	}

	return (
		<>
			{verifyState === "checking" && (
				<div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
					<Loader2 className="size-4 shrink-0 animate-spin text-primary" />
					<div className="flex-1">
						<div className="font-medium">Confirming your payment…</div>
						<div className="text-xs text-muted-foreground">This should only take a moment.</div>
					</div>
				</div>
			)}

			{verifyState === "success" && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
					<div className="flex items-center gap-2">
						<Check className="size-4 text-success" />
						<span className="font-medium">Payment confirmed — your plan has been updated.</span>
					</div>
					<Button size="sm" variant="ghost" onClick={() => setVerifyState("idle")}>Dismiss</Button>
				</div>
			)}

			{verifyState === "failed" && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
					<div className="flex items-center gap-2">
						<AlertCircle className="size-4 text-destructive" />
						<span className="font-medium">We couldn't confirm this payment. If you were charged, contact support.</span>
					</div>
					<Button size="sm" variant="ghost" onClick={() => setVerifyState("idle")}>Dismiss</Button>
				</div>
			)}

			<SettingsSection title="Current plan">
				{subLoading ? (
					<Skeleton className="h-16 rounded-lg" />
				) : subData ? (
					<div className="space-y-3">
						<div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<div className="flex items-center gap-2">
									<span className="font-semibold">{subData.plan.name} plan</span>
									<Badge>{subData.subscription.status}</Badge>
								</div>
								<div className="mt-1 text-xs text-muted-foreground">
									Billed {subData.subscription.billingCycle}
									{subData.subscription.nextBillingDate &&
										` · Next billing ${new Date(subData.subscription.nextBillingDate).toLocaleDateString()}`}
								</div>
							</div>
							<Button size="sm" variant="outline" onClick={() => setUpgradeOpen(true)}>
								Change plan
							</Button>
						</div>

						<div className="flex items-center justify-between rounded-lg border border-border p-4">
							<div>
								<div className="text-sm font-medium">Auto-renew</div>
								{autoRenewBlocked && (
									<div className="mt-0.5 text-xs text-muted-foreground">
										Pay with card once to enable auto-renew — bank transfer can't be auto-charged for renewals.
									</div>
								)}
							</div>
							<Switch
								checked={subData.subscription.autoRenew}
								disabled={toggleAutoRenew.isPending}
								onCheckedChange={handleAutoRenewChange}
							/>
						</div>
					</div>
				) : null}
			</SettingsSection>

			<SettingsSection title="Available plans" description="Compare plans below, or use Change plan above to switch.">
				{plansLoading ? (
					<div className="grid gap-4 md:grid-cols-3">
						<Skeleton className="h-64 rounded-xl" />
						<Skeleton className="h-64 rounded-xl" />
						<Skeleton className="h-64 rounded-xl" />
					</div>
				) : plans ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{plans.map((plan) => {
							const isCurrent = plan.id === subData?.subscription.planId;
							return (
								<div
									key={plan.id}
									className={`rounded-xl border p-4 ${
										isCurrent ? "border-primary bg-primary/5" : "border-border bg-card"
									}`}
								>
									<div className="flex items-start justify-between">
										<span className="font-semibold">{plan.name}</span>
										{isCurrent && <Badge>Current</Badge>}
									</div>
									<div className="mt-2 text-xl font-semibold">
										{plan.monthlyPriceKobo === 0 ? "₦0" : formatNaira(plan.monthlyPriceKobo)}
										<span className="text-xs font-normal text-muted-foreground">/mo</span>
									</div>
									<div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
										<Check className="size-3 text-primary" /> {plan.studentLimit === -1 ? "Unlimited" : plan.studentLimit} students
									</div>
								</div>
							);
						})}
					</div>
				) : null}
			</SettingsSection>

			<SettingsSection title="Billing history">
				<BillingHistoryList />
			</SettingsSection>

			{subData && (
				<UpgradePlanDialog
					currentPlanId={subData.subscription.planId}
					open={upgradeOpen}
					onOpenChange={setUpgradeOpen}
				/>
			)}
		</>
	);
}

function BillingHistoryList() {
	const { data, isLoading } = useBillingHistory({ limit: 10 });
	console.log("billin",data)

	if (isLoading) return <Skeleton className="h-40 rounded-xl" />;

	const entries = data?.entries ?? [];

	if (entries.length === 0) {
		return <p className="text-sm text-muted-foreground">No billing history yet.</p>;
	}

	return (
		<ul className="divide-y divide-border rounded-xl border border-border bg-card/60 text-sm">
			{entries.map((entry) => (
				<li key={entry.id} className="flex items-center justify-between p-4">
					<div>
						<div className="font-medium capitalize">{entry.billingCycle} billing</div>
						<div className="text-xs text-muted-foreground">
							{entry.paidAt
								? new Date(entry.paidAt).toLocaleDateString()
								: new Date(entry.createdAt).toLocaleDateString()}
							{entry.paystackReference ? ` · ${entry.paystackReference}` : ""}
						</div>
						{entry.failureReason && (
							<div className="mt-0.5 text-xs text-destructive">{entry.failureReason}</div>
						)}
					</div>
					<div className="text-right">
						<div>{formatNaira(entry.amountKobo)}</div>
						<Badge
							variant={
								entry.status === "success" ? "default" :
								entry.status === "failed" ? "destructive" :
								entry.status === "refunded" ? "outline" :
								"secondary"
							}
							className="capitalize"
						>
							{entry.status}
						</Badge>
					</div>
				</li>
			))}
		</ul>
	);
}