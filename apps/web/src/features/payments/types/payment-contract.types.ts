import type { Kobo } from "@/lib/money";

/*
| PAYMENTS: the shapes the API returns today (docs/backend/modules/payments.md, payment mapper, family-payment-visibility).
| Money is `Kobo` except inside a receipt, where it is ALWAYS a digit string. Read money only through `@/lib/money`.
| Staff-only fields are absent from the guardian shapes; students get no payments access at all (payments.pay is guardian-only).
*/

export type PaymentStatus = "PENDING" | "AWAITING_CONFIRMATION" | "CONFIRMED" | "FAILED" | "REVERSED";
export type PaymentMethod = "paystack" | "flutterwave" | "bank_transfer" | "cash" | "cheque" | "pos" | "other";
export type PayerType = "GUARDIAN" | "STUDENT" | "OTHER";

/** A staff list row (GET /payments). */
export interface PaymentSummary {
	id: string;
	status: PaymentStatus;
	method: PaymentMethod;
	payerType: PayerType;
	guardianId: string | null;
	payerName: string | null;
	amountKobo: Kobo;
	unallocatedKobo: Kobo;
	reference: string | null;
	branchId: string | null;
	paidOn: string | null;
	receiptNumber: string | null;
	createdAt: string;
}

export interface PaymentAllocation {
	id: string;
	invoiceId: string | null;
	invoiceNumber: string | null;
	studentId: string;
	studentName: string | null;
	amountKobo: Kobo;
	/** True when this part was kept as student credit instead of paying an invoice. */
	isCredit: boolean;
	reversed: boolean;
}

/** One payment with its allocations (GET /payments/:id). */
export interface PaymentDetail extends PaymentSummary {
	payerPhone: string | null;
	accountId: string;
	note: string | null;
	proofAttachmentId: string | null;
	targetStudentIds: string[];
	recordedById: string | null;
	confirmedById: string | null;
	confirmedAt: string | null;
	journalId: string | null;
	reversedAt: string | null;
	version: number;
	allocations: PaymentAllocation[];
}

/*
| A guardian's own list row (GET /payments/my). A guardian who did NOT make the payment only sees the share for their
| own children: `partial` is true, `amountKobo` is that share, and `reference`, `guardianId`, `unallocatedKobo` are null.
*/
export interface FamilyPayment {
	id: string;
	status: PaymentStatus;
	method: PaymentMethod;
	payerType: PayerType;
	payerName: string | null;
	isPayer: boolean;
	partial: boolean;
	amountKobo: Kobo;
	unallocatedKobo: Kobo | null;
	guardianId: string | null;
	reference: string | null;
	branchId: string | null;
	paidOn: string | null;
	receiptNumber: string | null;
	createdAt: string;
}

export interface ListMyPaymentsParams {
	page?: number;
	limit?: number;
	status?: PaymentStatus;
	method?: PaymentMethod;
	/** One of the guardian's own children; anyone else's id returns nothing. */
	studentId?: string;
	from?: string;
	to?: string;
}

export interface ReceiptLine {
	invoiceNumber: string | null;
	studentId: string;
	studentName: string | null;
	/** Digit string. */
	amountKobo: string;
	/** Digit string. */
	balanceAfterKobo: string;
}

/** GET /payments/my/:id/receipt: the frozen receipt cut down for this guardian. All money is a digit string. */
export interface FamilyReceipt {
	id: string;
	paymentId: string;
	receiptNumber: string;
	issuedAt: string;
	paidOn: string;
	status: PaymentStatus;
	school: { name: string | null; address: string | null; logoUrl: string | null; principalName: string | null };
	/** `phone` is only present for the payer. */
	payer: { type: PayerType; name: string | null; phone: string | null };
	method: PaymentMethod;
	/** Payer only. */
	reference: string | null;
	/** The payer's whole payment, or (when `partial`) the share that covers this guardian's children. */
	amountKobo: string;
	partial: boolean;
	lines: ReceiptLine[];
	credit: { studentId: string; studentName: string | null; amountKobo: string } | null;
	/** Payer only: the part that covers other people's children, with nothing that identifies them. */
	otherStudents: { amountKobo: string } | null;
}
