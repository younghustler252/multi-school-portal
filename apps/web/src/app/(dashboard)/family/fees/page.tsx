"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FamilyInvoiceCard } from "@/features/fees/components/family-invoice-card";
import { useFamilyChildren, useFamilyInvoices } from "@/features/fees/hooks/use-family-fees";
import { invoiceTotals, invoicesFor } from "@/features/fees/lib/family-fees";
import { PayOnlineDialog } from "@/features/payments/components/pay-online-dialog";
import type { FamilyInvoice } from "@/features/fees/types/finance.types";
import { FamilyReceiptDialog } from "@/features/payments/components/family-receipt-dialog";
import { formatKobo, isPositiveKobo } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { todayInLagos } from "@/lib/school-day";

/*
| A guardian's fees: balances from GET /fees/my/children, issued invoices from GET /fees/my/invoices, payment history per
| invoice, and receipts (guardian only). Online payment is a separate piece of work; it is not on this page yet.
*/
export default function GuardianFeesPage() {
	const children = useFamilyChildren();
	const invoices = useFamilyInvoices();
	const [scope, setScope] = useState<string>("all");
	const [receiptFor, setReceiptFor] = useState<string | null>(null);
	const [paying, setPaying] = useState<FamilyInvoice | null>(null);

	const shown = invoicesFor(invoices.data ?? [], scope);
	const totals = invoiceTotals(shown);
	const kids = children.data?.children ?? [];
	const today = todayInLagos();

	return (
		<>
			<PageHeader
				title="Fees"
				description={kids.length > 0 ? `${kids.length} ${kids.length === 1 ? "child" : "children"} · ${kids.map((c) => c.studentName.split(" ")[0]).join(", ")}` : "Invoices across all your children."}
				actions={scope !== "all" ? <Button variant="outline" nativeButton={false} render={<Link href={`${ROUTES.family.statement}?studentId=${scope}`}><FileText className="size-4" /> Statement</Link>} /> : undefined}
			/>

			{kids.length > 1 && (
				<div className="mb-6 flex flex-wrap gap-2">
					{[{ id: "all", label: "All children", owed: children.data?.totalOwedKobo }, ...kids.map((c) => ({ id: c.studentId, label: c.studentName.split(" ")[0], owed: c.owedKobo }))].map((c) => (
						<button
							key={c.id}
							type="button"
							onClick={() => setScope(c.id)}
							className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${scope === c.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
						>
							{c.label} {c.owed !== undefined && isPositiveKobo(c.owed) && <span className="ml-1 font-medium">· {formatKobo(c.owed)}</span>}
						</button>
					))}
				</div>
			)}

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard label="Total billed" value={formatKobo(totals.totalKobo)} accent="primary" />
				<StatCard label="Total paid" value={formatKobo(totals.paidKobo)} accent="success" />
				<StatCard label="Outstanding" value={formatKobo(totals.balanceKobo)} accent="warning" />
				<StatCard label="Credit held" value={formatKobo(scope === "all" ? children.data?.totalCreditKobo : kids.find((c) => c.studentId === scope)?.creditKobo)} hint="Applied to the next invoice" accent="info" />
			</div>

			<div className="space-y-4">
				{invoices.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
				{invoices.isError && <p className="text-sm text-destructive">Couldn&apos;t load your invoices. Try again in a moment.</p>}
				{!invoices.isLoading && !invoices.isError && shown.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">No invoices yet. The school will notify you when fees are issued.</div>
				)}
				{shown.map((inv) => <FamilyInvoiceCard key={inv.id} invoice={inv} today={today} onOpenReceipt={setReceiptFor} onPay={setPaying} />)}
			</div>

			<PayOnlineDialog invoice={paying} onClose={() => setPaying(null)} />
			<FamilyReceiptDialog paymentId={receiptFor} onClose={() => setReceiptFor(null)} />
		</>
	);
}
