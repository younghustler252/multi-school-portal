"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FamilyInvoiceCard } from "@/features/fees/components/family-invoice-card";
import { StatementView } from "@/features/fees/components/statement-view";
import { useFamilyChildren, useFamilyInvoices } from "@/features/fees/hooks/use-family-fees";
import { invoiceTotals } from "@/features/fees/lib/family-fees";
import { formatKobo } from "@/lib/money";
import { todayInLagos } from "@/lib/school-day";

/*
| A student's own fees: the same read-only family routes (fees.view at OWN), which return only this student.
| No receipts and no payments list: those are a guardian's (payments.pay is guardian-only).
*/
export default function StudentFeesPage() {
	const children = useFamilyChildren();
	const invoices = useFamilyInvoices();
	const me = children.data?.children[0];
	const totals = invoiceTotals(invoices.data ?? []);
	const today = todayInLagos();

	return (
		<>
			<PageHeader title="Fees" description="Your invoices and statement. Ask a parent or guardian to pay online." />

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard label="Total billed" value={formatKobo(totals.totalKobo)} accent="primary" />
				<StatCard label="Paid" value={formatKobo(totals.paidKobo)} accent="success" />
				<StatCard label="Outstanding" value={formatKobo(totals.balanceKobo)} accent="warning" />
				<StatCard label="Credit held" value={formatKobo(me?.creditKobo)} accent="info" />
			</div>

			<div className="space-y-4">
				{invoices.isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
				{invoices.isError && <p className="text-sm text-destructive">Couldn&apos;t load your invoices. Try again in a moment.</p>}
				{!invoices.isLoading && !invoices.isError && (invoices.data ?? []).length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">No invoices yet.</div>
				)}
				{(invoices.data ?? []).map((inv) => <FamilyInvoiceCard key={inv.id} invoice={inv} today={today} />)}
			</div>

			{me && (
				<section className="mt-10">
					<h2 className="mb-4 text-lg font-semibold">Statement</h2>
					<StatementView studentId={me.studentId} />
				</section>
			)}
		</>
	);
}
