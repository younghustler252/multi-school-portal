"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoices, useDefaulters } from "@/features/fees/hooks/use-fees";
import { usePayments } from "@/features/payments/hooks/use-payments";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { formatNaira } from "@/lib/format-money";
import { useAuthStore } from "@/stores/auth.store";

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

export default function BursarDashboardPage() {
	const user = useAuthStore((s) => s.user);
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: invoiceData, isLoading: invoicesLoading } = useInvoices({ termId, limit: 200 });
	const { data: defaulters } = useDefaulters();
	const { data: paymentData, isLoading: paymentsLoading } = usePayments({ limit: 200 });

	const totals = invoiceData?.invoices.reduce(
		(acc, inv) => {
			acc.expected += inv.amountKobo;
			acc.collected += inv.paidKobo;
			acc.outstanding += inv.balanceKobo;
			return acc;
		},
		{ expected: 0, collected: 0, outstanding: 0 }
	) ?? { expected: 0, collected: 0, outstanding: 0 };

	const todaysPayments = paymentData?.payments.filter(
		(p) => p.status === "success" && (p.paidAt ?? p.createdAt).slice(0, 10) === todayISO()
	) ?? [];
	const todaysTotal = todaysPayments.reduce((sum, p) => sum + p.amountKobo, 0);

	return (
		<>
			<PageHeader
				title={`Welcome, ${user?.firstName ?? ""}`}
				description="Fees and payments overview."
			/>

			{invoicesLoading || paymentsLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
				</div>
			) : (
				<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard label="Received today" value={formatNaira(todaysTotal)} hint={`${todaysPayments.length} transactions`} accent="success" />
					<StatCard label="Expected this term" value={formatNaira(totals.expected)} accent="primary" />
					<StatCard label="Outstanding" value={formatNaira(totals.outstanding)} accent="warning" />
					<StatCard
						label="Collection rate"
						value={totals.expected ? `${Math.round((totals.collected / totals.expected) * 100)}%` : "—"}
						accent="info"
					/>
				</div>
			)}

			{defaulters && defaulters.length > 0 && (
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
					<h3 className="font-medium">Top defaulters</h3>
					<ul className="mt-3 space-y-2.5">
						{defaulters.slice(0, 8).map((d) => (
							<li key={d.studentId} className="flex items-center justify-between text-sm">
								<span className="font-medium">{d.studentName}</span>
								<span className="text-muted-foreground">{formatNaira(d.totalOwedKobo)} owed</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</>
	);
}   