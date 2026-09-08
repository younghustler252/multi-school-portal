export interface FeeTypeEntity {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface FeeInvoiceEntity {
    id: string;
    studentId: string;
    termId: string;

    paidKobo: number;
    balanceKobo: number;
    status: "unpaid" | "partial" | "paid" | "waived";

    dueDate: Date | null;
    note: string | null;

    createdAt: Date;
    updatedAt: Date;

    items?: FeeInvoiceItemEntity[];
}

export interface FeeInvoiceItemEntity {
    id: string;
    invoiceId: string;
    feeTypeId: string;
    amountKobo: number;

    createdAt: Date;
    updatedAt: Date;
}
