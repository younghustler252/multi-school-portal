"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentMethodText } from "@/features/payments/lib/payment-labels";
import { formatKobo } from "@/lib/money";
import { useFamilyInvoicePayments } from "../hooks/use-family-fees";
import { formatDay, INVOICE_STATUS_BADGE, INVOICE_STATUS_TEXT, INVOICE_TYPE_TEXT } from "../lib/finance-labels";
import { isOverdue } from "../lib/family-fees";
import type { FamilyInvoice } from "../types/finance.types";

interface Props {
	invoice: FamilyInvoice;
	/** The school's day, "YYYY-MM-DD". */
	today: string;
	/** Only a guardian may open receipts (payments.pay is guardian-only); a student sees the payment lines without one. */
	onOpenReceipt?: (paymentId: string) => void;
}

/** One issued invoice of a child, with its payment history loaded when opened (GET /fees/my/invoices/:id/payments). */
export function FamilyInvoiceCard({ invoice, today, onOpenReceipt }: Props) {
	const [open, setOpen] = useState(false);
	const payments = useFamilyInvoicePayments(invoice.id, open);
	const overdue = isOverdue(invoice, today);

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="font-medium">{invoice.student.name}</div>
					<div className="mt-1 text-sm text-muted-foreground">
						{invoice.invoiceNumber ?? "Invoice"} · {INVOICE_TYPE_TEXT[invoice.type]}
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Issued {formatDay(invoice.issueDate)} · {invoice.dueDate ? `due ${formatDay(invoice.dueDate)}` : "no due date"}
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-1">
					<Badge variant={INVOICE_STATUS_BADGE[invoice.status]}>{INVOICE_STATUS_TEXT[invoice.status]}</Badge>
					{overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
				</div>
			</div>

			<dl className="mt-4 divide-y divide-border border-t border-border text-sm">
				<div className="flex justify-between py-2"><dt className="text-muted-foreground">Total</dt><dd>{formatKobo(invoice.totalKobo)}</dd></div>
				<div className="flex justify-between py-2"><dt className="text-muted-foreground">Paid to date</dt><dd>{formatKobo(invoice.paidKobo)}</dd></div>
				<div className="flex justify-between py-2 text-lg font-semibold"><dt>Balance</dt><dd>{formatKobo(invoice.balanceKobo)}</dd></div>
			</dl>

			<div className="mt-2 border-t border-border pt-2">
				<Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
					{open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} Payments on this invoice
				</Button>

				{open && (
					<div className="mt-2 text-sm">
						{payments.isLoading && <Skeleton className="h-10 rounded-lg" />}
						{payments.isError && <p className="text-destructive">Couldn&apos;t load the payments. Try again in a moment.</p>}
						{payments.data && payments.data.length === 0 && <p className="text-muted-foreground">No confirmed payments yet.</p>}
						{payments.data && payments.data.length > 0 && (
							<ul className="divide-y divide-border">
								{payments.data.map((p) => (
									<li key={p.paymentId} className="flex items-center justify-between gap-3 py-2">
										<div>
											<div className="font-medium">{formatKobo(p.allocatedKobo)}</div>
											<div className="text-xs text-muted-foreground">
												{paymentMethodText(p.method)} · {formatDay(p.paidOn)}{p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
											</div>
										</div>
										{onOpenReceipt && p.receiptNumber && (
											<Button variant="outline" size="sm" className="gap-1.5" onClick={() => onOpenReceipt(p.paymentId)}>
												<Receipt className="size-3.5" /> Receipt
											</Button>
										)}
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
