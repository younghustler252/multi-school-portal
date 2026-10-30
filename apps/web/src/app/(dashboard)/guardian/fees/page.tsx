"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ComingSoon } from "@/components/feedback/coming-soon";
import {
	useMyChildren,
	useMyChildrenInvoices,
} from "@/features/guardians/hooks/use-guardian-portal";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { PayInvoiceDialog } from "@/features/fees/components/pay-invoice-dialog";
import {
	INVOICE_STATUS_LABELS,
	INVOICE_STATUS_VARIANT,
} from "@/features/fees/constants/invoice-status";
import { formatNaira } from "@/lib/format-money";
import { CreditCard } from "lucide-react";
import { EnrichedInvoice } from "@/features/fees/types/fee.types";

export default function GuardianFeesPage() {
	const { data: children } = useMyChildren();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: invoiceData, isLoading } = useMyChildrenInvoices({ termId });

	const [scope, setScope] = useState<string>("all");
	const [payingInvoice, setPayingInvoice] = useState<EnrichedInvoice | null>(null);

	const allInvoices = invoiceData?.invoices ?? [];
	const invoices =
		scope === "all"
			? allInvoices
			: allInvoices.filter((inv) => inv.studentId === scope);

	const totalNet = invoices.reduce((sum, inv) => sum + (inv.subtotalKobo - inv.discountKobo), 0);
	const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidKobo, 0);
	const totalOwed = invoices.reduce((sum, inv) => sum + inv.balanceKobo, 0);
	const openCount = invoices.filter((inv) => inv.balanceKobo > 0).length;

	return (
		<>
			<PageHeader
				title="Fees & Payments"
				description={
					children && children.length > 0
						? `${children.length} ${children.length === 1 ? "child" : "children"} · ${children
								.map((c) => c.firstName)
								.join(", ")}`
						: "Invoices across all your children."
				}
			/>

			{children && children.length > 1 && (
				<div className="mb-6 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => setScope("all")}
						className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
							scope === "all"
								? "border-primary bg-primary/10 text-primary"
								: "border-border text-muted-foreground hover:bg-muted"
						}`}
					>
						All children
					</button>
					{children.map((c) => {
						const due = allInvoices
							.filter((inv) => inv.studentId === c.studentId)
							.reduce((sum, inv) => sum + inv.balanceKobo, 0);
						return (
							<button
								key={c.studentId}
								type="button"
								onClick={() => setScope(c.studentId)}
								className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
									scope === c.studentId
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground hover:bg-muted"
								}`}
							>
								{c.firstName} {due > 0 && <span className="ml-1 font-medium">· {formatNaira(due)}</span>}
							</button>
						);
					})}
				</div>
			)}

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard label="Total fees" value={formatNaira(totalNet)} accent="primary" />
				<StatCard label="Total paid" value={formatNaira(totalPaid)} accent="success" />
				<StatCard label="Total outstanding" value={formatNaira(totalOwed)} accent="warning" />
				<StatCard label="Open invoices" value={String(openCount)} accent="primary" />
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-4 lg:col-span-2">
					{isLoading &&
						Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}

					{!isLoading && invoices.length === 0 && (
						<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
							No invoices yet. The school will notify you when fees are published.
						</div>
					)}

					{invoices.map((inv) => (
						<div key={inv.id} className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0">
									<div className="font-medium">{inv.studentName}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{inv.className}
										{inv.termName ? ` · ${inv.termName}` : ""}
									</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{inv.dueDate ? `Due ${new Date(inv.dueDate).toLocaleDateString()}` : "No due date"}
									</div>
								</div>
								<Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>
									{INVOICE_STATUS_LABELS[inv.status]}
								</Badge>
							</div>

							<ul className="mt-4 divide-y divide-border border-t border-border text-sm">
								{inv.items.map((item) => (
									<li key={item.id} className="flex justify-between py-2">
										<span className="text-muted-foreground">{item.feeTypeName}</span>
										<span>{formatNaira(item.amountKobo)}</span>
									</li>
								))}
								{inv.discountKobo > 0 && (
									<li className="flex justify-between py-2 text-success">
										<span>Discount</span>
										<span>-{formatNaira(inv.discountKobo)}</span>
									</li>
								)}
								<li className="flex justify-between py-2 text-muted-foreground">
									<span>Paid to date</span>
									<span>{formatNaira(inv.paidKobo)}</span>
								</li>
								<li className="flex justify-between py-2 text-lg font-semibold">
									<span>Balance</span>
									<span>{formatNaira(inv.balanceKobo)}</span>
								</li>
							</ul>

							{inv.balanceKobo > 0 && (
								<div className="mt-4 flex justify-end border-t border-border pt-3">
									<Button size="sm" className="gap-2" onClick={() => setPayingInvoice(inv)}>
										<CreditCard className="size-3.5" /> Pay
									</Button>
								</div>
							)}
						</div>
					))}
				</div>

				<div className="h-fit rounded-xl border border-border bg-card p-6">
					<div className="mb-4 font-medium">Payment history</div>
					<ComingSoon
						title="Payment history"
						icon={CreditCard}
					/>
				</div>
			</div>

			{payingInvoice && (
				<PayInvoiceDialog
					invoice={payingInvoice}
					open={!!payingInvoice}
					onOpenChange={(o) => !o && setPayingInvoice(null)}
				/>
			)}
		</>
	);
}