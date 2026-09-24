import { z } from "zod";

// ── Common ────────────────────────────────────────────────────────────────

const InvoiceStatus = z.enum([
    "unpaid",
    "partial",
    "paid",
    "waived",
]);

const DueDate = z.string().datetime({ offset: true }).optional();

// ── Class fee template ───────────────────────────────────────────────────
// Defines how much a particular class pays for a particular fee type.

export const CreateClassFeeDto = z.object({
    classId: z.string().uuid(),
    feeTypeId: z.string().uuid(),
    termId: z.string().uuid(),
    amountKobo: z.number().int().positive(),
});

// ── Invoice entire class ─────────────────────────────────────────────────
// Creates invoices for all enrolled students in a class.
export const InvoiceClassDto = z.object({
	classIds: z
		.array(z.string().uuid())
		.min(1, "Select at least one class"),

	termId: z.string().uuid(),

	items: z
		.array(
			z.object({
				feeTypeId: z.string().uuid(),
				amountKobo: z.number().int().positive(),
			}),
		)
		.min(1),

	dueDate: DueDate,
});

// ── Fee type ──────────────────────────────────────────────────────────────

export const CreateFeeTypeDto = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().optional(),
});

export const UpdateFeeTypeDto = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().optional(),
});

// ── Fee invoice ──────────────────────────────────────────────────────────

export const CreateInvoiceDto = z.object({
    studentId: z.string().uuid(),
    termId: z.string().uuid(),

    items: z.array(
        z.object({
            feeTypeId: z.string().uuid(),
            amountKobo: z.number().int().positive(),
        })
    ).min(1),

    dueDate: z.string().datetime({ offset: true }).optional(),
    note: z.string().trim().optional(),
});


// ── Bulk create invoices ─────────────────────────────────────────────────
export const BulkCreateInvoiceDto = z.object({
    termId:     z.string().uuid(),
    studentIds: z.array(z.string().uuid()).min(1),
    items: z.array(z.object({
        feeTypeId:  z.string().uuid(),
        amountKobo: z.number().int().positive(),
    })).min(1),
    dueDate: DueDate,
});

export const UpdateInvoiceDto = z.object({
    discountKobo: z.number().int().min(0).optional(),
    dueDate:      DueDate,
    note:         z.string().trim().optional(),
});

// ── List invoices ─────────────────────────────────────────────────────────

export const ListInvoicesDto = z.object({
    page:      z.coerce.number().int().positive().default(1),
    limit:     z.coerce.number().int().positive().max(100).default(20),
    studentId: z.string().uuid().optional(),
    termId:    z.string().uuid().optional(),
    classId:   z.string().uuid().optional(),
    status:    InvoiceStatus.optional(),
});

export const CopyInvoiceFromClassDto = z.object({
	studentId: z.string().uuid(),
	classId: z.string().uuid(),
	termId: z.string().uuid(),
});


// ── Record payment ────────────────────────────────────────────────────────
export const RecordPaymentDto = z.object({
	invoiceId: z.string().uuid(),
	amountKobo: z.number().int().positive(),
	method: z.enum(["cash", "bank_transfer"]),
	note: z.string().trim().optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────

export type CreateClassFeeDtoType =
    z.infer<typeof CreateClassFeeDto>;

export type InvoiceClassDtoType =
    z.infer<typeof InvoiceClassDto>;

    export type CreateFeeTypeDtoType =
    z.infer<typeof CreateFeeTypeDto>;
    
    export type UpdateFeeTypeDtoType =
    z.infer<typeof UpdateFeeTypeDto>;
    
    export type CreateInvoiceDtoType =
    z.infer<typeof CreateInvoiceDto>;
    
    export type BulkCreateInvoiceDtoType =
    z.infer<typeof BulkCreateInvoiceDto>;
    
    export type CopyInvoiceFromClassDtoType = z.infer<typeof CopyInvoiceFromClassDto>;

    
export type UpdateInvoiceDtoType =
    z.infer<typeof UpdateInvoiceDto>;

export type ListInvoicesDtoType =
    z.infer<typeof ListInvoicesDto>;

export type RecordPaymentDtoType =
    z.infer<typeof RecordPaymentDto>;
