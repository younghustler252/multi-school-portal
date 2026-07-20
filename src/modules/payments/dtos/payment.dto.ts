import { z } from "zod";

// ── Initialize online payment ─────────────────────────────────────────────
export const InitializePaymentDto = z.object({
    invoiceId:   z.string().uuid(),
    callbackUrl: z.string().url().optional(),
});

// ── Verify payment ────────────────────────────────────────────────────────
export const VerifyPaymentDto = z.object({
    reference: z.string(),
});

// ── List payments ─────────────────────────────────────────────────────────
export const ListPaymentsDto = z.object({
    page:        z.string().optional(),
    limit:       z.string().optional(),
    invoiceId:   z.string().optional(),
    guardianId:  z.string().optional(),
    status:      z.string().optional(),
    method:      z.string().optional(),
    startDate:   z.string().optional(),
    endDate:     z.string().optional(),
});

export type InitializePaymentDtoType = z.infer<typeof InitializePaymentDto>;
export type VerifyPaymentDtoType     = z.infer<typeof VerifyPaymentDto>;
export type ListPaymentsDtoType      = z.infer<typeof ListPaymentsDto>;