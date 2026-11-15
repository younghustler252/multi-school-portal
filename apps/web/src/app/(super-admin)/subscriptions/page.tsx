"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtendPeriodDialog } from "@/features/subscriptions/components/platform/extend-period-dialog";
import { InvoiceActionDialog } from "@/features/subscriptions/components/platform/invoice-action-dialog";
import { PlatformChangePlanDialog } from "@/features/subscriptions/components/platform/platform-change-plan-dialog";
import { usePlatformBillingStats, usePlatformInvoices, usePlatformSubscriptions } from "@/features/subscriptions/hooks/use-platform-billing";
import { INVOICE_STATUS_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/features/subscriptions/lib/billing-status";
import type { InvoiceStatus, SubscriptionStatus } from "@/features/subscriptions/types/billing.types";
import type { PlatformInvoice, PlatformSubscription } from "@/features/subscriptions/types/platform-billing.types";
import { formatNaira } from "@/lib/format-money";
import { ROUTES } from "@/lib/routes";
import { useAccess } from "@/lib/use-access";

const ALL = "all";
const date = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

export default function AdminSubscriptionsPage() {
	const canManage = useAccess().can("platform.subscriptions.manage");
	const { data: stats, isLoading: statsLoading } = usePlatformBillingStats();

	return (
		<>
			<PageHeader title="Subscriptions" description="Every school's plan, and the invoices behind them." />

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
				{statsLoading || !stats ? (
					Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
				) : (
					<>
						<StatBox label="MRR" value={formatNaira(stats.mrrKobo)} />
						<StatBox label="ARR" value={formatNaira(stats.arrKobo)} />
						<StatBox label="Collected this month" value={formatNaira(stats.collectedThisMonthKobo)} />
						<StatBox label="Overdue" value={`${stats.overdueInvoices} · ${formatNaira(stats.overdueAmountKobo)}`} />
						<StatBox label="Paying schools" value={String(stats.payingSchools)} />
					</>
				)}
			</div>

			<Tabs defaultValue="subscriptions">
				<TabsList>
					<TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
					<TabsTrigger value="invoices">Invoices</TabsTrigger>
				</TabsList>
				<TabsContent value="subscriptions" className="pt-4"><SubscriptionsTab canManage={canManage} /></TabsContent>
				<TabsContent value="invoices" className="pt-4"><InvoicesTab canManage={canManage} /></TabsContent>
			</Tabs>
		</>
	);
}

function StatBox({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-border bg-card/80 p-4">
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="mt-1 text-lg font-semibold sm:text-xl">{value}</div>
		</div>
	);
}

function Pager({ meta, onPage }: { meta?: { page: number; totalPages: number; total: number; hasNext: boolean; hasPrev: boolean }; onPage: (p: number) => void }) {
	if (!meta || meta.totalPages <= 1) return null;
	return (
		<div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
			<span>Page {meta.page} of {meta.totalPages} · {meta.total} total</span>
			<div className="flex gap-2">
				<Button size="sm" variant="outline" disabled={!meta.hasPrev} onClick={() => onPage(meta.page - 1)}>Previous</Button>
				<Button size="sm" variant="outline" disabled={!meta.hasNext} onClick={() => onPage(meta.page + 1)}>Next</Button>
			</div>
		</div>
	);
}

function SubscriptionsTab({ canManage }: { canManage: boolean }) {
	const [status, setStatus] = useState<SubscriptionStatus | typeof ALL>(ALL);
	const [page, setPage] = useState(1);
	const { data, isLoading, isError } = usePlatformSubscriptions({ page, limit: 20, ...(status === ALL ? {} : { status }) });
	const [changing, setChanging] = useState<PlatformSubscription | null>(null);
	const [extending, setExtending] = useState<PlatformSubscription | null>(null);
	const rows = data?.data ?? [];

	return (
		<>
			<div className="mb-4 w-48">
				<Select value={status} onValueChange={(v) => { setStatus((v as SubscriptionStatus | typeof ALL) ?? ALL); setPage(1); }}>
					<SelectTrigger><SelectValue>{(v: string | null) => (v && v !== ALL ? SUBSCRIPTION_STATUS_LABEL[v as SubscriptionStatus] : "All statuses")}</SelectValue></SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>All statuses</SelectItem>
						{(Object.keys(SUBSCRIPTION_STATUS_LABEL) as SubscriptionStatus[]).map((s) => <SelectItem key={s} value={s}>{SUBSCRIPTION_STATUS_LABEL[s]}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			{isError ? <p className="text-sm text-destructive">Couldn't load subscriptions. Refresh to try again.</p> : (
				<div className="overflow-x-auto rounded-xl border border-border bg-card/60">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-xs text-muted-foreground">
							<tr>
								<th className="px-4 py-3 text-left">School</th>
								<th className="px-4 py-3 text-left">Plan</th>
								<th className="px-4 py-3 text-left">Status</th>
								<th className="px-4 py-3 text-left">Cycle</th>
								<th className="px-4 py-3 text-left">Period ends</th>
								<th className="px-4 py-3 text-right">Per month</th>
								{canManage && <th className="w-40" />}
							</tr>
						</thead>
						<tbody>
							{isLoading && Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
							))}
							{!isLoading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No subscriptions match.</td></tr>}
							{rows.map((sub) => (
								<tr key={sub.id} className="border-t border-border">
									<td className="px-4 py-3 font-medium"><Link href={ROUTES.platform.schools.detail(sub.schoolId)} className="hover:underline">{sub.schoolName}</Link></td>
									<td className="px-4 py-3">{sub.planName}</td>
									<td className="px-4 py-3"><Badge variant={sub.status === "past_due" ? "destructive" : "secondary"}>{SUBSCRIPTION_STATUS_LABEL[sub.status]}</Badge></td>
									<td className="px-4 py-3 capitalize text-muted-foreground">{sub.billingCycle}</td>
									<td className="px-4 py-3 text-muted-foreground">{date(sub.currentPeriodEnd)}</td>
									<td className="px-4 py-3 text-right">{formatNaira(sub.monthlyEquivalentKobo)}</td>
									{canManage && (
										<td className="px-4 py-3 text-right">
											<Button size="sm" variant="ghost" onClick={() => setChanging(sub)}>Plan</Button>
											<Button size="sm" variant="ghost" onClick={() => setExtending(sub)}>Extend</Button>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<Pager meta={data?.meta} onPage={setPage} />

			<PlatformChangePlanDialog schoolId={changing?.schoolId ?? ""} currentPlanId={changing?.planId} open={!!changing} onOpenChange={(o) => !o && setChanging(null)} />
			<ExtendPeriodDialog schoolId={extending?.schoolId ?? ""} open={!!extending} onOpenChange={(o) => !o && setExtending(null)} />
		</>
	);
}

function InvoicesTab({ canManage }: { canManage: boolean }) {
	const [status, setStatus] = useState<InvoiceStatus | "overdue" | typeof ALL>("overdue");
	const [page, setPage] = useState(1);
	const params = status === "overdue" ? { overdue: true } : status === ALL ? {} : { status };
	const { data, isLoading, isError } = usePlatformInvoices({ page, limit: 20, ...params });
	const [target, setTarget] = useState<{ invoice: PlatformInvoice; action: "void" | "mark-paid" } | null>(null);
	const rows = data?.data ?? [];

	return (
		<>
			<div className="mb-4 w-48">
				<Select value={status} onValueChange={(v) => { setStatus((v as typeof status) ?? ALL); setPage(1); }}>
					<SelectTrigger>
						<SelectValue>{(v: string | null) => (v === "overdue" ? "Overdue" : v && v !== ALL ? INVOICE_STATUS_LABEL[v as InvoiceStatus] : "All invoices")}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="overdue">Overdue</SelectItem>
						<SelectItem value={ALL}>All invoices</SelectItem>
						{(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((s) => <SelectItem key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			{isError ? <p className="text-sm text-destructive">Couldn't load invoices. Refresh to try again.</p> : (
				<div className="overflow-x-auto rounded-xl border border-border bg-card/60">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-xs text-muted-foreground">
							<tr>
								<th className="px-4 py-3 text-left">Invoice</th>
								<th className="px-4 py-3 text-left">School</th>
								<th className="px-4 py-3 text-left">Status</th>
								<th className="px-4 py-3 text-left">Due</th>
								<th className="px-4 py-3 text-right">Total</th>
								{canManage && <th className="w-40" />}
							</tr>
						</thead>
						<tbody>
							{isLoading && Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border"><td colSpan={6} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
							))}
							{!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No invoices match.</td></tr>}
							{rows.map((inv) => (
								<tr key={inv.id} className="border-t border-border">
									<td className="px-4 py-3 font-medium">{inv.number}</td>
									<td className="px-4 py-3"><Link href={ROUTES.platform.schools.detail(inv.schoolId)} className="hover:underline">{inv.schoolName}</Link></td>
									<td className="px-4 py-3"><Badge variant={inv.isOverdue ? "destructive" : inv.status === "paid" ? "default" : "secondary"}>{inv.isOverdue ? "Overdue" : INVOICE_STATUS_LABEL[inv.status]}</Badge></td>
									<td className="px-4 py-3 text-muted-foreground">{date(inv.dueDate)}</td>
									<td className="px-4 py-3 text-right">{formatNaira(inv.totalKobo)}</td>
									{canManage && (
										<td className="px-4 py-3 text-right">
											{inv.status === "open" && (
												<>
													<Button size="sm" variant="ghost" onClick={() => setTarget({ invoice: inv, action: "mark-paid" })}>Mark paid</Button>
													<Button size="sm" variant="ghost" className="text-destructive" onClick={() => setTarget({ invoice: inv, action: "void" })}>Void</Button>
												</>
											)}
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<Pager meta={data?.meta} onPage={setPage} />

			<InvoiceActionDialog invoice={target?.invoice ?? null} action={target?.action ?? "void"} onClose={() => setTarget(null)} />
		</>
	);
}
