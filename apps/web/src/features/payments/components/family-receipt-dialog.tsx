"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDay } from "@/features/fees/lib/finance-labels";
import { formatKobo } from "@/lib/money";
import { useFamilyReceipt } from "../hooks/use-family-payments";
import { paymentMethodText } from "../lib/payment-labels";

interface Props { paymentId: string | null; onClose: () => void }

/*
| A guardian's receipt (GET /payments/my/:id/receipt). It is the frozen receipt cut down by the server:
|  - the payer sees the whole payment; anyone else sees only the share for their own children ("partial")
|  - phone and reference are the payer's only; "other students" is one anonymous amount.
| Nothing is added or inferred here. A payment that is not theirs or has no receipt is simply "not found".
*/
export function FamilyReceiptDialog({ paymentId, onClose }: Props) {
	const { data: receipt, isLoading, isError } = useFamilyReceipt(paymentId);

	return (
		<Dialog open={!!paymentId} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{receipt ? `Receipt ${receipt.receiptNumber}` : "Receipt"}</DialogTitle>
					<DialogDescription>{receipt ? `${receipt.school.name ?? "School"} · paid ${formatDay(receipt.paidOn)}` : "Your payment receipt"}</DialogDescription>
				</DialogHeader>

				{isLoading && <Skeleton className="h-48 rounded-lg" />}
				{isError && <p className="text-sm text-destructive">This receipt isn&apos;t available. It may not be ready yet, or it may not be one you can see.</p>}

				{receipt && (
					<div className="space-y-4 text-sm print:text-black">
						<dl className="grid grid-cols-2 gap-x-4 gap-y-2">
							<dt className="text-muted-foreground">Paid by</dt>
							<dd>{receipt.payer.name ?? "—"}</dd>
							<dt className="text-muted-foreground">Method</dt>
							<dd>{paymentMethodText(receipt.method)}</dd>
							{receipt.reference && (<><dt className="text-muted-foreground">Reference</dt><dd className="break-all">{receipt.reference}</dd></>)}
							<dt className="text-muted-foreground">{receipt.partial ? "Your children's share" : "Amount paid"}</dt>
							<dd className="font-semibold">{formatKobo(receipt.amountKobo)}</dd>
						</dl>

						{receipt.partial && (
							<p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
								Someone else made this payment. You are seeing only the part that covers your own children.
							</p>
						)}

						{receipt.lines.length > 0 && (
							<table className="w-full text-left">
								<thead className="text-xs text-muted-foreground">
									<tr><th className="py-1 font-normal">Student / invoice</th><th className="py-1 text-right font-normal">Paid</th><th className="py-1 text-right font-normal">Balance after</th></tr>
								</thead>
								<tbody className="divide-y divide-border">
									{receipt.lines.map((l, i) => (
										<tr key={`${l.studentId}-${l.invoiceNumber ?? i}`}>
											<td className="py-2">{l.studentName ?? "Student"}<div className="text-xs text-muted-foreground">{l.invoiceNumber ?? "—"}</div></td>
											<td className="py-2 text-right">{formatKobo(l.amountKobo)}</td>
											<td className="py-2 text-right">{formatKobo(l.balanceAfterKobo)}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}

						{receipt.credit && (
							<div className="flex justify-between rounded-lg border border-border p-3">
								<span>Kept as credit for {receipt.credit.studentName ?? "student"}</span>
								<span className="font-medium">{formatKobo(receipt.credit.amountKobo)}</span>
							</div>
						)}

						{receipt.otherStudents && (
							<div className="flex justify-between rounded-lg border border-border p-3 text-muted-foreground">
								<span>Other students</span>
								<span>{formatKobo(receipt.otherStudents.amountKobo)}</span>
							</div>
						)}

						<div className="flex justify-end print:hidden">
							<Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}><Printer className="size-3.5" /> Print</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
