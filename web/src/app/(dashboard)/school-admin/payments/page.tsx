"use client";

import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePayments } from "@/features/payments/hooks/use-payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_VARIANT } from "@/features/payments/constants/payment-labels";
import { PaymentMethod, PaymentStatus } from "@/features/payments/types/payment.types";
import { formatNaira } from "@/lib/format-money";

export default function PaymentsPage() {
	const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
	const [methodFilter, setMethodFilter] = useState<PaymentMethod | "all">("all");

	const { data, isLoading } = usePayments({
		limit: 100,
		status: statusFilter === "all" ? undefined : statusFilter,
		method: methodFilter === "all" ? undefined : methodFilter,
	});

	const totals = data?.payments.reduce(
		(acc, p) => {
			if (p.status === "success") acc.successful += p.amountKobo;
			if (p.status === "pending") acc.pending += 1;
			return acc;
		},
		{ successful: 0, pending: 0 }
	) ?? { successful: 0, pending: 0 };

	return (
		<>
			<PageHeader title="Payments" description="All payment transactions across your school." />

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard label="Total received" value={formatNaira(totals.successful)} accent="success" />
				<StatCard label="Pending" value={String(totals.pending)} accent="warning" />
				<StatCard label="Transactions" value={String(data?.payments.length ?? 0)} accent="primary" />
			</div>

			<div className="mb-4 flex flex-wrap gap-2">
				<Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "all") as PaymentStatus | "all")}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Status">
							{(value: string | null) =>
								value === "all" || !value ? "All statuses" : value.charAt(0).toUpperCase() + value.slice(1)
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="success">Success</SelectItem>
						<SelectItem value="failed">Failed</SelectItem>
						<SelectItem value="refunded">Refunded</SelectItem>
					</SelectContent>
				</Select>

				<Select value={methodFilter} onValueChange={(v) => setMethodFilter((v ?? "all") as PaymentMethod | "all")}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Method">
							{(value: string | null) =>
								value === "all" || !value ? "All methods" : PAYMENT_METHOD_LABELS[value as PaymentMethod]
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All methods</SelectItem>
						{Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
							<SelectItem key={value} value={value}>{label}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="overflow-x-auto rounded-xl border border-border bg-card/60">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Reference</th>
							<th className="px-4 py-3 text-left">Method</th>
							<th className="px-4 py-3 text-right">Amount</th>
							<th className="px-4 py-3 text-right">Status</th>
							<th className="px-4 py-3 text-left">Date</th>
							<th className="w-10" />
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border">
									<td colSpan={6} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
								</tr>
							))}

						{!isLoading && data?.payments.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
									No payments recorded yet.
								</td>
							</tr>
						)}

						{data?.payments.map((payment) => (
							<tr key={payment.id} className="border-t border-border hover:bg-muted/30">
								<td className="px-4 py-3 font-mono text-xs">
									{payment.reference ?? "—"}
								</td>
								<td className="px-4 py-3 text-muted-foreground">
									{PAYMENT_METHOD_LABELS[payment.method]}
								</td>
								<td className="px-4 py-3 text-right font-medium">
									{formatNaira(payment.amountKobo)}
								</td>
								<td className="px-4 py-3 text-right">
									<Badge variant={PAYMENT_STATUS_VARIANT[payment.status]} className="capitalize">
										{payment.status}
									</Badge>
								</td>
								<td className="px-4 py-3 text-muted-foreground">
									{payment.paidAt
										? new Date(payment.paidAt).toLocaleDateString()
										: new Date(payment.createdAt).toLocaleDateString()}
								</td>
								<td className="px-2 py-3">
									{payment.receiptUrl && (
										<a
											href={payment.receiptUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
										>
											<ExternalLink className="size-3" /> Receipt
										</a>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}