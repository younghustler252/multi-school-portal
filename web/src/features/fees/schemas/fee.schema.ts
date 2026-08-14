import { z } from "zod";

export const createFeeTypeSchema = z.object({
	name: z.string().min(1, "Fee name is required").max(100),
	description: z.string().optional(),
});
export type CreateFeeTypeFormValues = z.infer<typeof createFeeTypeSchema>;

export const invoiceClassSchema = z.object({
	classId: z.string().uuid("Select a class"),
	termId: z.string().uuid(),
	feeTypeId: z.string().uuid("Select a fee type"),
	amountNaira: z.string().min(1, "Enter an amount"),
	dueDate: z.string().optional(),
});
export type InvoiceClassFormValues = z.infer<typeof invoiceClassSchema>;

export const recordPaymentSchema = z.object({
	invoiceId: z.string().uuid(),
	amountNaira: z.string().min(1, "Enter an amount"),
	note: z.string().optional(),
});
export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>;