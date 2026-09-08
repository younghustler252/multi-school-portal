export interface FeeInvoiceItemInput {
    feeTypeId: string;
    amountKobo: number;
}
export interface EnrichedInvoiceItem {
    id: string;
    feeTypeId: string;
    feeTypeName: string;
    amountKobo: number;
}

export interface EnrichedInvoice {
    id: string;
    studentId: string;
    studentName: string;
    termId: string;
    termName: string;
    discountKobo: number;
    subtotalKobo: number;
    paidKobo: number;
    balanceKobo: number;
    status: string;
    dueDate: Date | null;
    note: string | null;
    items: EnrichedInvoiceItem[];
    createdAt: Date;
}
