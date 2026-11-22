import type { AdjustmentStatus, AdjustmentType, InvoiceStatus, InvoiceType, StatementKind } from "../types/finance.types";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const INVOICE_STATUS_TEXT: Record<InvoiceStatus, string> = {
	draft: "Draft",
	unpaid: "Unpaid",
	partial: "Partly paid",
	paid: "Paid",
	waived: "Waived",
	void: "Void",
};

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, BadgeVariant> = {
	draft: "outline",
	unpaid: "destructive",
	partial: "secondary",
	paid: "default",
	waived: "outline",
	void: "outline",
};

export const INVOICE_TYPE_TEXT: Record<InvoiceType, string> = {
	TERM_FEES: "Term fees",
	ADMISSION: "Admission",
	ADHOC: "One-off charge",
	OPENING_BALANCE: "Opening balance",
};

export const STATEMENT_KIND_TEXT: Record<StatementKind, string> = {
	INVOICE: "Invoice",
	ADJUSTMENT: "Adjustment",
	PAYMENT: "Payment",
	REVERSAL: "Payment reversed",
	REFUND: "Refund",
};

export const ADJUSTMENT_TYPE_TEXT: Record<AdjustmentType, string> = {
	WAIVER: "Waiver",
	WRITE_OFF: "Write-off",
	CREDIT_NOTE: "Credit note",
	ADDITIONAL_DISCOUNT: "Extra discount",
};

export const ADJUSTMENT_STATUS_TEXT: Record<AdjustmentStatus, string> = {
	PENDING: "Waiting for approval",
	APPROVED: "Approved",
	REJECTED: "Rejected",
};

/** A "YYYY-MM-DD" day for people ("5 Nov 2026"), without letting the browser's timezone move it. */
export function formatDay(day: string | null | undefined, empty = "—"): string {
	if (!day) return empty;
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
	if (!m) return empty;
	const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
	return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
