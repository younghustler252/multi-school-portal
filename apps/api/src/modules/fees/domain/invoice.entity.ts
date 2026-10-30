export type InvoiceType = "TERM_FEES" | "ADMISSION" | "ADHOC" | "OPENING_BALANCE";
export type InvoiceStatus = "draft" | "unpaid" | "partial" | "paid" | "waived" | "void";
export type StudentType = "NEW" | "RETURNING";

export interface InvoiceItemEntity {
    id: string; feeTypeId: string | null; description: string; incomeAccountId: string; amountKobo: bigint; sortOrder: number;
}

export interface InvoiceDiscountEntity {
    id: string; ruleId: string | null; feeTypeId: string | null; label: string; amountKobo: bigint;
}

export interface FeeInvoiceEntity {
    id: string; invoiceNumber: string | null; type: InvoiceType; status: InvoiceStatus;
    studentId: string; studentName: string | null; admissionNumber: string | null;
    sessionId: string | null; termId: string | null; classId: string | null; branchId: string | null; sourceStructureId: string | null;
    issueDate: Date | null; dueDate: Date | null;
    subtotalKobo: bigint; discountKobo: bigint; adjustmentsKobo: bigint; totalKobo: bigint; paidKobo: bigint; balanceKobo: bigint;
    journalId: string | null; note: string | null; version: number;
    voidedAt: Date | null; voidReason: string | null; createdAt: Date;
    items: InvoiceItemEntity[]; discounts: InvoiceDiscountEntity[];
}

export interface InvoiceFilters {
    status?: InvoiceStatus; type?: InvoiceType; termId?: string; classId?: string; studentId?: string; branchId?: string; q?: string;
}

// What gets saved with a new or rewritten draft
export interface NewInvoiceItem { feeTypeId: string | null; description: string; incomeAccountId: string; amountKobo: bigint; sortOrder: number }
export interface NewInvoiceDiscount { ruleId: string | null; feeTypeId: string | null; label: string; amountKobo: bigint }

// A student found by generation
export interface EnrolledStudent { studentId: string; name: string; admissionNumber: string | null; classId: string }
export interface TermInfo { id: string; sessionId: string; startDate: Date }

// A discount a student holds, ready to be worked out
export interface DiscountInput { ruleId: string; label: string; type: "PERCENT" | "FIXED"; value: bigint; feeTypeId: string | null }
