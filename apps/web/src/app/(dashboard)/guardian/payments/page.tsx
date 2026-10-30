"use client";

import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useVerifyPayment, useMyPayments } from "@/features/payments/hooks/use-payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_VARIANT } from "@/features/payments/constants/payment-labels";
import { formatNaira } from "@/lib/format-money";

export default function GuardianPaymentsPage() {
	const searchParams = useSearchParams();
	const reference = searchParams.get("reference") ?? searchParams.get("trxref");
	const { data: payment, isLoading: verifying, isError } = useVerifyPayment(reference);
	const { data, isLoading: historyLoading } = useMyPayments({ limit: 50 });

	return (
		<>
			<PageHeader title="Payments" description="Your payment history." />

			{reference && (
				<div className="mb-6 rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
					{verifying && (
						<div className="flex items-center gap-3">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
							<span className="text-sm text-muted-foreground">Confirming your payment…</span>
						</div>
					)}
					{isError && (
						<div className="flex items-center gap-3 text-destructive">
							<XCircle className="size-5" />
							<span className="text-sm">Couldn&apos;t confirm this payment — contact the school if you were charged.</span>
						</div>
					)}
					{payment && payment.status === "success" && (
						<div className="flex items-center gap-3 text-success">
							<CheckCircle2 className="size-5" />
							<span className="text-sm font-medium">Payment of {formatNaira(payment.amountKobo)} confirmed</span>
						</div>
					)}
					{payment && payment.status !== "success" && (
						<div className="flex items-center gap-3 text-destructive">
							<XCircle className="size-5" />
							<span className="text-sm">Payment {payment.status}</span>
						</div>
					)}
				</div>
			)}

			<div className="space-y-2">
				{historyLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}

				{!historyLoading && data?.payments.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
						No payments yet.
					</div>
				)}

				{data?.payments.map((p) => (
					<div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-3 text-sm">
						<div>
							<div className="font-medium">{formatNaira(p.amountKobo)}</div>
							<div className="text-xs text-muted-foreground">
								{PAYMENT_METHOD_LABELS[p.method]} · {new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}
							</div>
						</div>
						<Badge variant={PAYMENT_STATUS_VARIANT[p.status]} className="capitalize">{p.status}</Badge>
					</div>
				))}
			</div>
		</>
	);
}