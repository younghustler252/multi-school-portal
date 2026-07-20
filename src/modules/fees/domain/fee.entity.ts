export interface FeeTypeEntity {
    id:          string;
    name:        string;
    description: string | null;
    createdAt:   Date;
    updatedAt:   Date;
}

export interface FeeInvoiceEntity {
    id:          string;
    studentId:   string;
    termId:      string;
    feeTypeId:   string;
    amountKobo:  number;
    paidKobo:    number;
    balanceKobo: number;
    status:      string;
    dueDate:     Date | null;
    note:        string | null;
    createdAt:   Date;
    updatedAt:   Date;
}