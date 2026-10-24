export type AgeingBucket = "CURRENT" | "DAYS_1_30" | "DAYS_31_60" | "DAYS_61_90" | "OVER_90";
export type BucketTotals = Record<AgeingBucket, bigint>;

// One issued invoice that still owes money
export interface OpenInvoiceRow {
    id: string; invoiceNumber: string | null; studentId: string; studentName: string; admissionNumber: string | null;
    classId: string | null; className: string | null; branchId: string | null; termId: string | null;
    issueDate: Date | null; dueDate: Date | null; totalKobo: bigint; balanceKobo: bigint;
}

export interface AgeingStudent {
    studentId: string; studentName: string; admissionNumber: string | null; classId: string | null; className: string | null;
    buckets: BucketTotals; totalKobo: bigint; overdueKobo: bigint; oldestDaysOverdue: number; invoices: number;
}

export interface AgeingReport { asOf: string; students: AgeingStudent[]; totals: BucketTotals; totalKobo: bigint; overdueKobo: bigint }

export interface ReportFilters { branchId?: string; classId?: string; termId?: string; studentIds?: string[] }

// One confirmed payment as the collections report sees it
export interface CollectionRow {
    id: string; method: string; amountKobo: bigint; paidOn: string; branchId: string | null; receiptNumber: string | null;
    byClass: { classId: string | null; className: string | null; amountKobo: bigint }[];      // what went to invoices, by the invoice's class
    creditKobo: bigint;                                                                       // what was kept as credit
}

export type CollectionGroup = "method" | "day" | "month" | "branch" | "class";
export interface CollectionLine { key: string; label: string; count: number; totalKobo: bigint }
export interface CollectionReport { from: string; to: string; groupBy: CollectionGroup; lines: CollectionLine[]; payments: number; totalKobo: bigint; creditKobo: bigint }

export type StatementKind = "INVOICE" | "ADJUSTMENT" | "PAYMENT" | "REVERSAL" | "REFUND";
// Positive moves what the student owes up; negative moves it down. The running balance below zero means the student is in credit.
export interface StatementEntry { date: string; kind: StatementKind; reference: string | null; description: string; amountKobo: bigint; balanceKobo: bigint }

export interface StatementSource {
    student: { id: string; name: string; admissionNumber: string | null };
    invoices: { id: string; invoiceNumber: string | null; issueDate: Date | null; subtotalKobo: bigint; discountKobo: bigint; status: string; createdAt: Date }[];
    adjustments: { id: string; invoiceNumber: string | null; type: string; amountKobo: bigint; decidedAt: Date | null; reason: string }[];       // approved ones; the amount is positive
    payments: { paymentId: string; receiptNumber: string | null; method: string; paidAt: Date | null; status: string; amountKobo: bigint }[];       // what each payment gave THIS student (invoices + credit)
    refunds: { id: string; receiptNumber: string | null; paidAt: Date | null; amountKobo: bigint }[];
    openBalanceKobo: bigint; creditKobo: bigint;
}

export interface Statement {
    student: StatementSource["student"]; from: string | null; to: string | null; openingKobo: bigint; entries: StatementEntry[];
    totals: { chargedKobo: bigint; adjustedKobo: bigint; paidKobo: bigint; refundedKobo: bigint };
    closingKobo: bigint; owedKobo: bigint; creditKobo: bigint;
}
