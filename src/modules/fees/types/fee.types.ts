import { InvoiceStatus } from "../domain/fee.enums";

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
// EnrichedInvoice — add to the interface
export interface EnrichedInvoice {
    id:            string;
    studentId:     string;
    studentName:   string;
    classId:       string | null;
    className:     string | null;
    termId:        string;
    termName:      string;
    discountKobo:  number;
    subtotalKobo:  number;
    paidKobo:      number;
    balanceKobo:   number;
    status:        string;
    dueDate:       Date | null;
    note:          string | null;
    items:         EnrichedInvoiceItem[];
    createdAt:     Date;
}