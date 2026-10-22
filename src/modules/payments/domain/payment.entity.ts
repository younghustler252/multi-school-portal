export type PaymentMethod = "paystack" | "flutterwave" | "bank_transfer" | "cash" | "cheque" | "pos" | "other";
export type ManualPaymentMethod = "cash" | "bank_transfer" | "cheque" | "pos" | "other";
export type PaymentStatus = "PENDING" | "AWAITING_CONFIRMATION" | "CONFIRMED" | "FAILED" | "REVERSED";
export type PayerType = "GUARDIAN" | "STUDENT" | "OTHER";

export interface PaymentAllocationEntity {
    id: string; invoiceId: string | null; invoiceNumber: string | null; studentId: string; studentName: string | null; amountKobo: bigint; reversedAt: Date | null;
}

export interface ReceiptEntity {
    id: string; receiptNumber: string; paymentId: string; issuedAt: Date; snapshot: ReceiptSnapshot;
}

export interface PaymentEntity {
    id: string; payerType: PayerType; guardianId: string | null; payerName: string | null; payerPhone: string | null; branchId: string | null;
    method: PaymentMethod; amountKobo: bigint; unallocatedKobo: bigint; accountId: string; status: PaymentStatus;
    reference: string | null; proofAttachmentId: string | null; targetStudentIds: string[]; note: string | null;
    paidAt: Date | null; recordedById: string | null; confirmedById: string | null; confirmedAt: Date | null;
    journalId: string | null; reversedAt: Date | null; version: number; createdAt: Date;
    allocations: PaymentAllocationEntity[]; receiptNumber: string | null;
}

export interface PaymentFilters {
    status?: PaymentStatus; method?: PaymentMethod; guardianId?: string; studentId?: string; from?: Date; to?: Date; branchId?: string;
}

// What the receipt says, frozen when it is issued. Money is kobo as digit strings so the JSON never loses precision.
export interface ReceiptSnapshot {
    receiptNumber: string; issuedAt: string; paidOn: string;
    school: { name: string | null; address: string | null; logoUrl: string | null; principalName: string | null };
    payer: { type: PayerType; name: string | null; phone: string | null };
    method: PaymentMethod; reference: string | null; amountKobo: string;
    lines: { invoiceNumber: string | null; studentId: string; studentName: string | null; amountKobo: string; balanceAfterKobo: string }[];
    credit: { studentId: string; studentName: string | null; amountKobo: string } | null;
}

// An open invoice as allocation sees it
export interface OpenInvoice {
    id: string; studentId: string; invoiceNumber: string | null; dueDate: Date | null; issueDate: Date | null; balanceKobo: bigint; version: number;
}

export interface PlannedAllocation { invoiceId: string; studentId: string; amountKobo: bigint }
export interface AllocationPlan { invoices: PlannedAllocation[]; creditKobo: bigint; creditStudentId: string | null }

export interface PaymentPerson { id: string; name: string }
export interface SchoolHeader { name: string | null; address: string | null; logoUrl: string | null; principalName: string | null }
