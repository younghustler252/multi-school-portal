"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVerifyOnlinePayment } from "../hooks/use-online-payment";
import { outcomeText, verifyPaymentError } from "../lib/online-payment";

interface Props { reference: string; onReceipt: (paymentId: string) => void; onDismiss: () => void }

/*
| Shown when the guardian is sent back from the gateway (?reference=...). It asks the server for the real result; it never
| trusts anything in the address. A "pending" answer keeps checking for about half a minute, then waits for a tap.
*/
export function PaymentReturnBanner({ reference, onReceipt, onDismiss }: Props) {
	const verify = useVerifyOnlinePayment(reference);
	const result = verify.data;
	const outcome = result ? outcomeText(result.state) : null;
	const failure = verify.isError ? verifyPaymentError(verify.error) : null;
	const tone = outcome?.tone === "success" ? "border-success/40 bg-success/5" : outcome?.tone === "failure" ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40";

	return (
		<div className={`mb-6 rounded-xl border p-4 text-sm ${tone}`} role="status">
			{verify.isLoading && <div className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Checking your payment…</div>}

			{outcome && result && (
				<div className="space-y-1">
					<div className="font-medium">{outcome.title}</div>
					<p className="text-muted-foreground">{outcome.body}</p>
					<div className="flex flex-wrap gap-2 pt-2">
						{(result.state === "confirmed" || result.state === "already") && result.payment.receiptNumber && (
							<Button size="sm" onClick={() => onReceipt(result.payment.id)}>View receipt</Button>
						)}
						{result.state === "pending" && <Button size="sm" variant="outline" onClick={() => verify.refetch()} disabled={verify.isFetching}>{verify.isFetching ? "Checking…" : "Check again"}</Button>}
						<Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
					</div>
				</div>
			)}

			{failure && (
				<div className="space-y-1">
					<p>{failure.message}</p>
					<div className="flex gap-2 pt-2">
						{failure.retryable && <Button size="sm" variant="outline" onClick={() => verify.refetch()} disabled={verify.isFetching}>Try again</Button>}
						<Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
					</div>
				</div>
			)}
		</div>
	);
}
