import { z } from "zod";


// ── Common ────────────────────────────────────────────────────────────────

const optionalDueDate = z
	.string()
	.datetime({ offset: true })
	.optional();

const amountNaira = z
	.string()
	.trim()
	.min(1, "Enter an amount")
	.refine(
		(value) => {
			const amount = Number(value);
			return Number.isFinite(amount) && amount > 0;
		},
		"Amount must be greater than zero",
	);


// ── Fee Type ──────────────────────────────────────────────────────────────

export const createFeeTypeSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Fee name is required")
		.max(100, "Fee name must not exceed 100 characters"),

	description: z
		.string()
		.trim()
		.optional(),
});

export type CreateFeeTypeFormValues =
	z.infer<typeof createFeeTypeSchema>;

// ── Invoice Entire Class ──────────────────────────────────────────────────

const invoiceClassItemSchema = z.object({
	feeTypeId: z
		.string()
		.uuid("Select a fee type"),

	amountNaira,
});

export const invoiceClassSchema = z.object({
	classIds: z
		.array(z.string().uuid())
		.min(1, "Select at least one class"),

	termId: z
		.string()
		.uuid("Select a term"),

	items: z
		.array(invoiceClassItemSchema)
		.min(1, "Add at least one fee item"),

	// Plain "YYYY-MM-DD" from the date input, converted to an ISO
	// datetime with offset before it's sent to the backend.
	dueDate: z.string().optional(),
});

export type InvoiceClassFormValues =
	z.infer<typeof invoiceClassSchema>;

// ── Record Payment ────────────────────────────────────────────────────────
// ── Record Payment ────────────────────────────────────────────────────────

export const recordPaymentSchema = z.object({
	invoiceId: z
		.string()
		.uuid(),

	amountNaira,

	method: z.enum(["cash", "bank_transfer"], {
		message: "Select a payment method",
	}),


	note: z
		.string()
		.trim()
		.optional(),
});

// ── Apply / Edit Invoice Discount ─────────────────────────────────────────

export const discountInvoiceSchema = z.object({
	discountNaira: z
		.string()
		.trim()
		.refine(
			(value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0),
			"Discount must be zero or greater",
		),
});
// ── Guardian Partial Payment ───────────────────────────────────────────────

export function partialPaymentSchema(balanceKobo: number) {
	return z.object({
		amountNaira: z
			.string()
			.trim()
			.min(1, "Enter an amount")
			.refine((value) => {
				const amount = Number(value);
				return Number.isFinite(amount) && amount > 0;
			}, "Amount must be greater than zero")
			.refine((value) => {
				const amountKobo = Math.round(Number(value) * 100);
				return amountKobo <= balanceKobo;
			}, "Amount can't exceed the balance due"),
	});
}

export type PartialPaymentFormValues = { amountNaira: string };

export type DiscountInvoiceFormValues =
	z.infer<typeof discountInvoiceSchema>;
export type RecordPaymentFormValues =
	z.infer<typeof recordPaymentSchema>;
