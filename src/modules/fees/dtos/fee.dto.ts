import { z } from "zod";

// ── Fee type ──────────────────────────────────────────────────────────────

// ── Create class fee template ─────────────────────────────────────────────
// School admin defines how much each class pays per fee type
export const CreateClassFeeDto = z.object({
    classId:    z.string().uuid(),
    feeTypeId:  z.string().uuid(),
    amountKobo: z.number().int().positive(),
    termId:     z.string().uuid(),
});

// ── Auto-invoice entire class ─────────────────────────────────────────────
// Creates invoices for all enrolled students in a class at class-specific amount
export const InvoiceClassDto = z.object({
    classId:    z.string().uuid(),
    termId:     z.string().uuid(),
    feeTypeId:  z.string().uuid(),
    amountKobo: z.number().int().positive(),
    dueDate:    z.string().optional(),
});

export const CreateFeeTypeDto = z.object({
    name:        z.string().min(1).max(100),
    description: z.string().optional(),
});

export const UpdateFeeTypeDto = z.object({
    name:        z.string().min(1).max(100).optional(),
    description: z.string().optional(),
});

// ── Fee invoice ───────────────────────────────────────────────────────────
export const CreateInvoiceDto = z.object({
    studentId:  z.string().uuid(),
    termId:     z.string().uuid(),
    feeTypeId:  z.string().uuid(),
    amountKobo: z.number().int().positive(),
    dueDate:    z.string().optional(),
    note:       z.string().optional(),
});

// ── Bulk create invoices ──────────────────────────────────────────────────
export const BulkCreateInvoiceDto = z.object({
    termId:     z.string().uuid(),
    feeTypeId:  z.string().uuid(),
    amountKobo: z.number().int().positive(),
    dueDate:    z.string().optional(),
    studentIds: z.array(z.string().uuid()).min(1),
});

// ── Update invoice ────────────────────────────────────────────────────────
export const UpdateInvoiceDto = z.object({
    amountKobo: z.number().int().positive().optional(),
    dueDate:    z.string().optional(),
    note:       z.string().optional(),
    status:     z.enum(["unpaid", "partial", "paid", "waived"]).optional(),
});

// ── List invoices ─────────────────────────────────────────────────────────
export const ListInvoicesDto = z.object({
    page:      z.string().optional(),
    limit:     z.string().optional(),
    studentId: z.string().optional(),
    termId:    z.string().optional(),
    feeTypeId: z.string().optional(),
    status:    z.string().optional(),
});

// Add to fee.dto.ts
export const RecordPaymentDto = z.object({
    invoiceId:  z.string().uuid(),
    amountKobo: z.number().int().positive(),
    note:       z.string().optional(),
});


export type CreateClassFeeDtoType = z.infer<typeof CreateClassFeeDto>;
export type InvoiceClassDtoType   = z.infer<typeof InvoiceClassDto>;
export type CreateFeeTypeDtoType    = z.infer<typeof CreateFeeTypeDto>;
export type UpdateFeeTypeDtoType    = z.infer<typeof UpdateFeeTypeDto>;
export type CreateInvoiceDtoType    = z.infer<typeof CreateInvoiceDto>;
export type BulkCreateInvoiceDtoType = z.infer<typeof BulkCreateInvoiceDto>;
export type UpdateInvoiceDtoType    = z.infer<typeof UpdateInvoiceDto>;
export type ListInvoicesDtoType     = z.infer<typeof ListInvoicesDto>;
export type RecordPaymentDtoType = z.infer<typeof RecordPaymentDto>;