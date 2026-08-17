"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useVerifyPayment } from "@/features/payments/hooks/use-payments";
import { formatNaira } from "@/lib/format-money";
import Link from "next/link";

export default function GuardianPaymentsPage() {
	const searchParams = useSearchParams();
	const reference = searchParams.get("reference");
	const { data: payment, isLoading, isError } = useVerifyPayment(reference);

	if (!reference) {
		return (
			<>
				<PageHeader title="Payments" description="Payment confirmations appear here after checkout." />
				<p className="text-sm text-muted-foreground">
					No recent payment to confirm. Go to{" "}
					<Link href="/guardian/fees" className="text-primary hover:underline">Fees</Link> to make a payment.
				</p>
			</>
		);
	}

	return (
		<>
			<PageHeader title="Payment confirmation" />

			<div className="mx-auto max-w-sm text-center">
				{isLoading && (
					<div className="flex flex-col items-center gap-3 py-10">
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground">Confirming your payment…</p>
					</div>
				)}

				{isError && (
					<div className="flex flex-col items-center gap-3 py-10">
						<XCircle className="size-10 text-destructive" />
						<p className="font-medium">Couldn&apos;t confirm this payment</p>
						<p className="text-sm text-muted-foreground">Please contact the school if you were charged.</p>
					</div>
				)}

				{payment && payment.status === "success" && (
					<div className="flex flex-col items-center gap-3 py-10">
						<CheckCircle2 className="size-10 text-success" />
						<p className="font-medium">Payment successful</p>
						<p className="text-2xl font-semibold">{formatNaira(payment.amountKobo)}</p>
						<Button nativeButton={false} render={<Link href="/guardian/fees">Back to fees</Link>} />
					</div>
				)}

				{payment && payment.status !== "success" && (
					<div className="flex flex-col items-center gap-3 py-10">
						<XCircle className="size-10 text-destructive" />
						<p className="font-medium">Payment {payment.status}</p>
						<Button variant="outline" nativeButton={false} render={<Link href="/guardian/fees">Try again</Link>} />
					</div>
				)}
			</div>
		</>
	);
}