import type { Kobo } from "@/lib/money";

/*
| FEES: the shapes the API returns today (docs/backend/modules/fees.md, fee mappers and use cases on refactor/api).
| Money is `Kobo` (number, or a digit string past 2^53): read it only through `@/lib/money`.
| Dates are "YYYY-MM-DD" strings, timestamps are ISO strings. This file does not replace `fee.types.ts` yet:
| the staff screens still use that one until their own slices move them over.
*/

export type InvoiceStatus = "draft" | "unpaid" | "partial" | "paid" | "waived" | "void";
export type InvoiceType = "TERM_FEES" | "ADMISSION" | "ADHOC" | "OPENING_BALANCE";

/** The three persona-visible statuses: families never see `draft` or `void`. */
export type FamilyInvoiceStatus = Exclude<InvoiceStatus, "draft" | "void">;

export interface StudentRef {
	id: string;
	name: string | null;
	admissionNumber: string | null;
}

/** One line of a staff invoice list (GET /fees/invoices): no items. */
export interface InvoiceSummary {
	id: string;
	invoiceNumber: string | null;
	type: InvoiceType;
	status: InvoiceStatus;
	student: StudentRef;
	sessionId: string | null;
	termId: string | null;
	classId: string | null;
	branchId: string | null;
	issueDate: string | null;
	dueDate: string | null;
	subtotalKobo: Kobo;
	discountKobo: Kobo;
	adjustmentsKobo: Kobo;
	totalKobo: Kobo;
	paidKobo: Kobo;
	balanceKobo: Kobo;
	createdAt: string;
}

export interface InvoiceItem {
	id: string;
	feeTypeId: string | null;
	description: string;
	amountKobo: Kobo;
	sortOrder: number;
}

export interface InvoiceDiscount {
	id: string;
	ruleId: string | null;
	feeTypeId: string | null;
	label: string;
	amountKobo: Kobo;
}

/** One staff invoice (GET /fees/invoices/:id). */
export interface InvoiceDetail extends InvoiceSummary {
	sourceStructureId: string | null;
	journalId: string | null;
	note: string | null;
	/** Send it back on a draft edit: a mismatch stops a stale save. */
	version: number;
	voidedAt: string | null;
	voidReason: string | null;
	items: InvoiceItem[];
	discounts: InvoiceDiscount[];
}

// ── Family (fees.view, OWN: a guardian's linked children, or the student) ──

/** GET /fees/my/children */
export interface FamilyChildBalance {
	studentId: string;
	studentName: string;
	admissionNumber: string | null;
	className: string | null;
	owedKobo: Kobo;
	overdueInvoices: number;
	creditKobo: Kobo;
}

export interface FamilyChildren {
	children: FamilyChildBalance[];
	totalOwedKobo: Kobo;
	totalCreditKobo: Kobo;
}

/** GET /fees/my/invoices[?studentId=]: issued invoices only (never draft or void), no line items. */
export interface FamilyInvoice {
	id: string;
	invoiceNumber: string | null;
	student: { id: string; name: string };
	status: FamilyInvoiceStatus;
	type: InvoiceType;
	issueDate: string | null;
	dueDate: string | null;
	totalKobo: Kobo;
	paidKobo: Kobo;
	balanceKobo: Kobo;
}

/** GET /fees/my/invoices/:id/payments: confirmed payments, only the part that went to this invoice. */
export interface FamilyInvoicePayment {
	paymentId: string;
	receiptNumber: string | null;
	method: string;
	status: string;
	paidOn: string | null;
	allocatedKobo: Kobo;
}

/** GET /fees/invoices/:id/payments (staff): adds the reference and the payment's own total. */
export interface StaffInvoicePayment extends FamilyInvoicePayment {
	reference: string | null;
	recordedAt: string;
	paymentTotalKobo: Kobo;
}

// ── Statements (staff: GET /fees/statements/:studentId, family: GET /fees/my/statement/:studentId) ──

export type StatementKind = "INVOICE" | "ADJUSTMENT" | "PAYMENT" | "REVERSAL" | "REFUND";

export interface StatementEntry {
	date: string;
	kind: StatementKind;
	reference: string | null;
	description: string;
	/** Positive raises what is owed, negative lowers it. */
	amountKobo: Kobo;
	/** Running balance; below zero means the student is in credit. */
	balanceKobo: Kobo;
}

export interface Statement {
	student: StudentRef & { name: string };
	from: string | null;
	to: string | null;
	openingKobo: Kobo;
	closingKobo: Kobo;
	owedKobo: Kobo;
	creditKobo: Kobo;
	totals: { chargedKobo: Kobo; adjustedKobo: Kobo; paidKobo: Kobo; refundedKobo: Kobo };
	entries: StatementEntry[];
}

export interface StatementParams {
	from?: string;
	to?: string;
}

// ── Adjustments (POST /fees/adjustments: a request that another person approves) ──

export type AdjustmentType = "WAIVER" | "WRITE_OFF" | "CREDIT_NOTE" | "ADDITIONAL_DISCOUNT";
export type AdjustmentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface RequestAdjustmentDto {
	invoiceId: string;
	type: AdjustmentType;
	/** A credit note names the fee it cancels; no other type may. */
	invoiceItemId?: string;
	amountKobo: Kobo;
	reason: string;
}
