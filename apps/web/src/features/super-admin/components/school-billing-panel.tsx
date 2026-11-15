"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformChangePlanDialog } from "@/features/subscriptions/components/platform/platform-change-plan-dialog";
import { ExtendPeriodDialog } from "@/features/subscriptions/components/platform/extend-period-dialog";
import { useSchoolBilling } from "@/features/subscriptions/hooks/use-platform-billing";
import { INVOICE_STATUS_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/features/subscriptions/lib/billing-status";
import { formatNaira } from "@/lib/format-money";
import { useAccess } from "@/lib/use-access";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

interface Props {
	schoolId: string;
	changePlanOpen: boolean;
	onChangePlanOpenChange: (open: boolean) => void;
}

/** Subscription and recent invoices for one school, with the platform's plan and period actions. */
export function SchoolBillingPanel({ schoolId, changePlanOpen, onChangePlanOpenChange }: Props) {
	const canManage = useAccess().can("platform.subscriptions.manage");
	const { data, isLoading, isError } = useSchoolBilling(schoolId);
	const [extendOpen, setExtendOpen] = useState(false);

	if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
	const sub = data?.subscription;

	return (
		<div className="rounded-xl border border-border bg-card/80 p-6">
			<div className="mb-4 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 font-medium"><Receipt className="size-4" /> Billing</div>
				{canManage && sub && <Button size="sm" variant="outline" onClick={() => setExtendOpen(true)}>Extend period</Button>}
			</div>

			{isError || !sub ? (
				<p className="text-sm text-muted-foreground">This school has no subscription yet.</p>
			) : (
				<>
					<dl className="mb-4 space-y-2 text-sm">
						<Row label="Plan" value={data.plan?.name ?? "—"} />
						<Row label="Status" value={SUBSCRIPTION_STATUS_LABEL[sub.status]} />
						<Row label="Billing" value={sub.billingCycle === "yearly" ? "Yearly" : "Monthly"} />
						<Row label="Current period ends" value={date(sub.currentPeriodEnd)} />
						{sub.cancelAtPeriodEnd && <Row label="Cancellation" value="At period end" />}
					</dl>
					<div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent invoices</div>
					{data.recentInvoices.length === 0 ? (
						<p className="text-sm text-muted-foreground">No invoices yet.</p>
					) : (
						<ul className="divide-y divide-border text-sm">
							{data.recentInvoices.map((inv) => (
								<li key={inv.id} className="flex items-center justify-between gap-3 py-3">
									<div className="min-w-0">
										<div className="font-medium">{inv.number}</div>
										<div className="truncate text-xs text-muted-foreground">{date(inv.issuedAt)} · {inv.items[0]?.description ?? inv.reason}</div>
										{inv.lastFailureReason && <div className="mt-0.5 text-xs text-destructive">{inv.lastFailureReason}</div>}
									</div>
									<div className="text-right">
										<div>{formatNaira(inv.totalKobo)}</div>
										<Badge variant={inv.status === "paid" ? "default" : inv.isOverdue ? "destructive" : "secondary"}>
											{inv.isOverdue ? "Overdue" : INVOICE_STATUS_LABEL[inv.status]}
										</Badge>
									</div>
								</li>
							))}
						</ul>
					)}
				</>
			)}

			<PlatformChangePlanDialog schoolId={schoolId} currentPlanId={sub?.planId} open={changePlanOpen} onOpenChange={onChangePlanOpenChange} />
			<ExtendPeriodDialog schoolId={schoolId} open={extendOpen} onOpenChange={setExtendOpen} />
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between gap-4">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="font-medium">{value}</dd>
		</div>
	);
}
