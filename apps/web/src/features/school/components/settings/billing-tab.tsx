"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { SettingsSection } from "./settings-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/lib/use-access";
import { useBillingSummary, useVerifyPayment } from "@/features/subscriptions/hooks/use-billing";
import { ChangePlanDialog } from "@/features/subscriptions/components/change-plan-dialog";
import { AutoRenewCard, BillingNotices, InvoicesSection, PlanSummary, UsageMeters } from "@/features/subscriptions/components/billing-sections";

type VerifyState = "idle" | "checking" | "success" | "pending" | "failed";

export function BillingTab() {
	const me = useAccess();
	const canView = me.can("billing.view");
	const canManage = me.can("billing.manage");
	const { data: summary, isLoading, isError } = useBillingSummary(canView);
	const verify = useVerifyPayment();
	const [changeOpen, setChangeOpen] = useState(false);

	// Back from the payment page: ask the API whether the payment went through (the browser's word is never enough).
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const reference = searchParams.get("reference") ?? searchParams.get("trxref");
	const [verifyState, setVerifyState] = useState<VerifyState>("idle");
	const checked = useRef<string | null>(null);

	useEffect(() => {
		if (!reference || checked.current === reference || !canManage) return;
		checked.current = reference;
		setVerifyState("checking");
		const params = new URLSearchParams(searchParams.toString());
		params.delete("reference");
		params.delete("trxref");
		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
		verify.mutate(reference, {
			onSuccess: (r) => setVerifyState(r.status === "success" ? "success" : r.status === "pending" ? "pending" : "failed"),
			onError: () => setVerifyState("failed"),
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reference, canManage]);

	if (!canView) {
		return (
			<SettingsSection title="Plan and billing">
				<p className="text-sm text-muted-foreground">You don&apos;t have permission to view billing.</p>
			</SettingsSection>
		);
	}

	return (
		<>
			{verifyState === "checking" && (
				<div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
					<Loader2 className="size-4 shrink-0 animate-spin text-primary" />
					<div>
						<div className="font-medium">Confirming your payment…</div>
						<div className="text-xs text-muted-foreground">This should only take a moment.</div>
					</div>
				</div>
			)}
			{verifyState === "success" && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
					<span className="flex items-center gap-2 font-medium"><Check className="size-4 text-success" /> Payment confirmed. Your plan is up to date.</span>
					<Button size="sm" variant="ghost" onClick={() => setVerifyState("idle")}>Dismiss</Button>
				</div>
			)}
			{verifyState === "pending" && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
					<span>Your payment is still being processed. Check again in a minute; if you were charged, your plan updates once the bank confirms.</span>
					<Button size="sm" variant="outline" onClick={() => reference && verify.mutate(reference)}>Refresh</Button>
				</div>
			)}
			{verifyState === "failed" && (
				<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
					<span className="flex items-center gap-2 font-medium"><AlertCircle className="size-4 text-destructive" /> We couldn&apos;t confirm this payment. If you were charged, contact support.</span>
					<Button size="sm" variant="ghost" onClick={() => setVerifyState("idle")}>Dismiss</Button>
				</div>
			)}

			{isLoading && <Skeleton className="h-40 rounded-xl" />}
			{isError && <p className="text-sm text-destructive">Couldn&apos;t load billing. Please try again.</p>}

			{summary && (
				<div className="space-y-4">
					<BillingNotices summary={summary} />

					<SettingsSection title="Current plan">
						<div className="space-y-4">
							<PlanSummary summary={summary} canManage={canManage} onChangePlan={() => setChangeOpen(true)} />
							<UsageMeters summary={summary} />
						</div>
					</SettingsSection>

					<SettingsSection title="Renewal and payment">
						<AutoRenewCard summary={summary} canManage={canManage} />
					</SettingsSection>

					<SettingsSection title="Invoices">
						<InvoicesSection summary={summary} canManage={canManage} />
					</SettingsSection>

					<ChangePlanDialog summary={summary} open={changeOpen} onOpenChange={setChangeOpen} />
				</div>
			)}
		</>
	);
}
