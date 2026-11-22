"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatKobo } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import type { FamilyInvoice } from "@/features/fees/types/finance.types";
import { useInitializeOnlinePayment } from "../hooks/use-online-payment";
import { checkPayAmount, returnUrl, startPaymentError } from "../lib/online-payment";

interface Props { invoice: FamilyInvoice | null; onClose: () => void }

/*
| Pay one invoice online. The whole balance by default, or part of it. Nothing is paid here: we ask the server to start a
| payment, then send the guardian to the gateway's page. The gateway sends them back to the Payments page, which checks the result.
*/
export function PayOnlineDialog({ invoice, onClose }: Props) {
	const [amount, setAmount] = useState("");
	const [problem, setProblem] = useState<string | null>(null);
	const start = useInitializeOnlinePayment();

	if (!invoice) return null;
	const check = checkPayAmount(amount, invoice.balanceKobo);
	const redirecting = start.isSuccess;

	async function submit() {
		if (!invoice || !check.ok) { setProblem(check.ok ? null : check.message); return; }
		setProblem(null);
		try {
			const started = await start.mutateAsync({
				invoiceId: invoice.id,
				...(check.amountKobo !== undefined ? { amountKobo: check.amountKobo } : {}),
				callbackUrl: returnUrl(window.location.origin, ROUTES.family.payments),
			});
			window.location.assign(started.authorizationUrl);
		} catch (err) {
			toast.error(startPaymentError(err));
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && !redirecting && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Pay online</DialogTitle>
					<DialogDescription>{invoice.student.name} · {invoice.invoiceNumber ?? "Invoice"}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 text-sm">
					<div className="flex justify-between rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground">Balance</span><span className="font-semibold">{formatKobo(invoice.balanceKobo)}</span></div>

					<label className="block">
						<span className="mb-1 block text-muted-foreground">Amount to pay (₦). Leave empty to pay the whole balance.</span>
						<Input inputMode="decimal" placeholder={formatKobo(invoice.balanceKobo).replace("₦", "")} value={amount} onChange={(e) => { setAmount(e.target.value); setProblem(null); }} disabled={start.isPending || redirecting} />
					</label>
					{(problem || (!check.ok && amount.trim() !== "")) && <p className="text-destructive">{problem ?? (check.ok ? "" : check.message)}</p>}

					<p className="text-xs text-muted-foreground">
						You&apos;ll be taken to our payment partner to pay securely. Afterwards you&apos;ll come back here and see your receipt.
					</p>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={start.isPending || redirecting}>Cancel</Button>
					<Button onClick={submit} disabled={!check.ok || start.isPending || redirecting} className="gap-2">
						{(start.isPending || redirecting) && <Loader2 className="size-4 animate-spin" />}
						{redirecting ? "Opening payment page…" : `Pay ${formatKobo(check.ok && check.amountKobo !== undefined ? check.amountKobo : invoice.balanceKobo)}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
