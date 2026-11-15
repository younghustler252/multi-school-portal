"use client";

import { useState } from "react";
import { AlertTriangle, CreditCard, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNaira } from "@/lib/format-money";
import { isApiError } from "@/lib/api/api-error";
import {
	useCancelDowngrade, useCancelSubscription, useInvoices, usePayInvoice, useRemovePaymentMethod, useResumeSubscription, useSetAutoRenew,
} from "../hooks/use-billing";
import { INVOICE_STATUS_LABEL, SUBSCRIPTION_STATUS_LABEL, billingNotices, usagePercent } from "../lib/billing-status";
import type { BillingSummary, Invoice } from "../types/billing.types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export function BillingNotices({ summary }: { summary: BillingSummary }) {
	const notices = billingNotices(summary);
	if (notices.length === 0) return null;
	return (
		<div className="mb-4 space-y-2">
			{notices.map((n) => (
				<div key={n.title} className={`flex gap-3 rounded-lg border p-4 text-sm ${n.tone === "warning" ? "border-warning/40 bg-warning/10" : "border-border bg-muted/40"}`}>
					{n.tone === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> : <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
					<div>
						<div className="font-medium">{n.title}</div>
						<div className="text-muted-foreground">{n.body}</div>
					</div>
				</div>
			))}
		</div>
	);
}

export function PlanSummary({ summary, canManage, onChangePlan }: { summary: BillingSummary; canManage: boolean; onChangePlan: () => void }) {
	const { subscription: sub, plan } = summary;
	const cancel = useCancelSubscription();
	const resume = useResumeSubscription();
	const cancelDowngrade = useCancelDowngrade();
	const [cancelOpen, setCancelOpen] = useState(false);
	const isFree = plan.isFree;

	async function run(fn: () => Promise<unknown>, done: string) {
		try { await fn(); toast.success(done); } catch (err) { toast.error((err as Error).message || "Something went wrong"); }
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<span className="font-semibold">{plan.name} plan</span>
						<Badge variant={sub.status === "past_due" ? "destructive" : "secondary"}>{SUBSCRIPTION_STATUS_LABEL[sub.status]}</Badge>
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						{isFree ? "No charge" : `Billed ${sub.billingCycle}`}
						{!isFree && sub.nextBillingDate && ` · Next billing ${day(sub.nextBillingDate)}`}
						{sub.status === "trialing" && sub.trialEndsAt && ` · Trial ends ${day(sub.trialEndsAt)}`}
					</div>
				</div>
				{canManage && (
					<div className="flex flex-wrap gap-2">
						<Button size="sm" variant="outline" onClick={onChangePlan}>Change plan</Button>
						{sub.cancelAtPeriodEnd && <Button size="sm" variant="outline" disabled={resume.isPending} onClick={() => run(() => resume.mutateAsync(), "Subscription resumed")}>Resume</Button>}
						{summary.scheduledDowngrade && <Button size="sm" variant="outline" disabled={cancelDowngrade.isPending} onClick={() => run(() => cancelDowngrade.mutateAsync(), "Downgrade cancelled")}>Keep current plan</Button>}
						{!isFree && !sub.cancelAtPeriodEnd && <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>}
					</div>
				)}
			</div>

			<Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cancel your subscription?</DialogTitle>
						<DialogDescription>Your school keeps {plan.name} until {day(sub.currentPeriodEnd)}, then moves to the Free plan. You can resume any time before then. Your data is never deleted.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCancelOpen(false)}>Keep my plan</Button>
						<Button
							variant="destructive"
							disabled={cancel.isPending}
							onClick={async () => { await run(() => cancel.mutateAsync(false), "Cancellation scheduled"); setCancelOpen(false); }}
						>
							{cancel.isPending && <Loader2 className="size-4 animate-spin" />} Cancel at period end
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export function UsageMeters({ summary }: { summary: BillingSummary }) {
	if (summary.usage.length === 0) return null;
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{summary.usage.map((m) => {
				const pct = usagePercent(m.used, m.limit);
				return (
					<div key={m.key} className="rounded-lg border border-border p-4">
						<div className="flex items-baseline justify-between text-sm">
							<span className="font-medium">{m.name}</span>
							<span className="text-muted-foreground">{m.used.toLocaleString("en-NG")} of {m.limit === null ? "unlimited" : m.limit.toLocaleString("en-NG")}</span>
						</div>
						{pct !== null && (
							<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
								<div className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

export function AutoRenewCard({ summary, canManage }: { summary: BillingSummary; canManage: boolean }) {
	const setAutoRenew = useSetAutoRenew();
	const removeMethod = useRemovePaymentMethod();
	const [needsCard, setNeedsCard] = useState(false);
	const card = summary.paymentMethod;

	async function toggle(enabled: boolean) {
		try {
			await setAutoRenew.mutateAsync(enabled);
			setNeedsCard(false);
			toast.success(enabled ? "Auto-renew turned on" : "Auto-renew turned off");
		} catch (err) {
			if (isApiError(err) && err.code === "AUTO_RENEW_NEEDS_CARD") setNeedsCard(true);
			else toast.error((err as Error).message || "Couldn't update auto-renew");
		}
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between rounded-lg border border-border p-4">
				<div>
					<div className="text-sm font-medium">Auto-renew</div>
					<div className="mt-0.5 text-xs text-muted-foreground">
						{needsCard ? "Pay by card once to save it, then you can turn this on. Bank transfers can't be charged automatically." : "Charge your saved card when the plan renews."}
					</div>
				</div>
				<Switch checked={summary.subscription.autoRenew} disabled={!canManage || setAutoRenew.isPending} onCheckedChange={toggle} />
			</div>
			{card && (
				<div className="flex items-center justify-between rounded-lg border border-border p-4 text-sm">
					<div className="flex items-center gap-3">
						<CreditCard className="size-5 text-muted-foreground" />
						<div>
							<div className="font-medium capitalize">{card.brand ?? "Card"} ending {card.last4 ?? "····"}</div>
							{card.expMonth && card.expYear && <div className="text-xs text-muted-foreground">Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}</div>}
						</div>
					</div>
					{canManage && (
						<Button
							size="sm"
							variant="ghost"
							disabled={removeMethod.isPending}
							onClick={async () => {
								try { await removeMethod.mutateAsync(card.id); toast.success("Card removed"); } catch (err) { toast.error((err as Error).message || "Couldn't remove the card"); }
							}}
						>
							Remove
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

function InvoiceRow({ invoice, canPay, onPay, paying }: { invoice: Invoice; canPay: boolean; onPay: (id: string) => void; paying: boolean }) {
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 p-4">
			<div>
				<div className="font-medium">{invoice.number}</div>
				<div className="text-xs text-muted-foreground">
					{invoice.status === "paid" && invoice.paidAt ? `Paid ${day(invoice.paidAt)}` : `Due ${day(invoice.dueDate)}`} · <span className="capitalize">{invoice.reason}</span> · {day(invoice.periodStart)} to {day(invoice.periodEnd)}
				</div>
				{invoice.lastFailureReason && <div className="mt-0.5 text-xs text-destructive">{invoice.lastFailureReason}</div>}
			</div>
			<div className="flex items-center gap-3">
				<div className="text-right">
					<div>{formatNaira(invoice.totalKobo)}</div>
					<Badge variant={invoice.status === "paid" ? "default" : invoice.isOverdue ? "destructive" : "secondary"}>{invoice.isOverdue ? "Overdue" : INVOICE_STATUS_LABEL[invoice.status]}</Badge>
				</div>
				{invoice.status === "open" && canPay && (
					<Button size="sm" disabled={paying} onClick={() => onPay(invoice.id)}>Pay now</Button>
				)}
			</div>
		</li>
	);
}

export function InvoicesSection({ summary, canManage, onPayStarted }: { summary: BillingSummary; canManage: boolean; onPayStarted?: () => void }) {
	const [page, setPage] = useState(1);
	const history = useInvoices({ page, limit: 10 });
	const pay = usePayInvoice();

	async function handlePay(id: string) {
		try {
			const checkout = await pay.mutateAsync({ id, autoRenew: summary.subscription.autoRenew });
			onPayStarted?.();
			window.location.href = checkout.authorizationUrl;
		} catch (err) {
			toast.error((err as Error).message || "Couldn't start payment");
		}
	}

	if (history.isLoading) return <Skeleton className="h-40 rounded-xl" />;
	const invoices = history.data?.data ?? [];
	const meta = history.data?.meta;
	if (invoices.length === 0) return <p className="text-sm text-muted-foreground">No invoices yet.</p>;

	return (
		<>
			<ul className="divide-y divide-border rounded-xl border border-border bg-card/60 text-sm">
				{invoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} canPay={canManage} onPay={handlePay} paying={pay.isPending} />)}
			</ul>
			{meta && meta.totalPages > 1 && (
				<div className="mt-3 flex items-center justify-center gap-3 text-sm text-muted-foreground">
					<Button size="sm" variant="outline" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
					<span>Page {meta.page} of {meta.totalPages}</span>
					<Button size="sm" variant="outline" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
				</div>
			)}
		</>
	);
}
