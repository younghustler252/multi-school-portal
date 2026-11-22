import { CollectionRow, OpenInvoiceRow, ReportFilters, StatementSource } from "../domain/report.entity";

export interface InvoicePaymentRow {
    paymentId: string; allocatedKobo: bigint; allocatedAt: Date; method: string; status: string; reference: string | null;
    paidAt: Date | null; paymentCreatedAt: Date; paymentTotalKobo: bigint; receiptNumber: string | null;
}

/* Read-only questions for the reports, statements and the family views. */
export interface IFeeReportRepository {
    openInvoices(filters: ReportFilters): Promise<OpenInvoiceRow[]>;                                        // issued, still owing
    confirmedPayments(from: Date, to: Date, branchId?: string): Promise<CollectionRow[]>;
    branchNames(ids: string[]): Promise<Map<string, string>>;
    statementSource(studentId: string): Promise<StatementSource | null>;
    childIdsOf(persona: "GUARDIAN" | "STUDENT", personaEntityId: string): Promise<string[]>;               // who a family login may see
    familyInvoices(studentIds: string[], studentId?: string): Promise<{ id: string; invoiceNumber: string | null; studentId: string; studentName: string; status: string; type: string;
        issueDate: Date | null; dueDate: Date | null; totalKobo: bigint; paidKobo: bigint; balanceKobo: bigint }[]>;
    invoiceForPayments(invoiceId: string): Promise<{ id: string; studentId: string; status: string } | null>;
    /** Money applied to one invoice: live allocations of CONFIRMED payments, newest first. */
    invoicePayments(invoiceId: string): Promise<InvoicePaymentRow[]>;
    familySummary(studentIds: string[]): Promise<{ studentId: string; studentName: string; admissionNumber: string | null; className: string | null; owedKobo: bigint; overdueInvoices: number; creditKobo: bigint }[]>;
}
