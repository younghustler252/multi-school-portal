import { IFeeReportRepository, InvoicePaymentRow } from "../repositories/fee-report.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import { feeErrors } from "../domain/fee.errors";
import { myStudentIds, Viewer } from "./fee-report.usecases";

interface Dependencies { feeReportRepository: IFeeReportRepository }

/*
| PAYMENTS APPLIED TO ONE INVOICE (the invoice screen's payment history).
| Only confirmed payments, only the part of each that went to THIS invoice (a payment can be split over several invoices, so
| the invoice-level amount is `allocatedKobo`; the payment's own total is shown to staff only).
*/

/* STAFF: GET /fees/invoices/:id/payments (fees.invoices.view and payments.view). */
export const staffInvoicePaymentOut = (r: InvoicePaymentRow) => ({
    paymentId: r.paymentId, receiptNumber: r.receiptNumber, method: r.method, status: r.status, reference: r.reference,
    paidOn: r.paidAt ? dayOut(r.paidAt) : null, recordedAt: r.paymentCreatedAt,
    allocatedKobo: koboOut(r.allocatedKobo), paymentTotalKobo: koboOut(r.paymentTotalKobo),
});

/* FAMILY: GET /fees/my/invoices/:id/payments. Invoice facts only: no payer identity, no gateway reference, no internal notes, no payment total. */
export const familyInvoicePaymentOut = (r: InvoicePaymentRow) => ({
    paymentId: r.paymentId, receiptNumber: r.receiptNumber, method: r.method, status: r.status,
    paidOn: r.paidAt ? dayOut(r.paidAt) : null, allocatedKobo: koboOut(r.allocatedKobo),
});

export class InvoicePaymentsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(invoiceId: string) {
        if (!(await this.d.feeReportRepository.invoiceForPayments(invoiceId))) throw feeErrors.invoiceNotFound();
        return (await this.d.feeReportRepository.invoicePayments(invoiceId)).map(staffInvoicePaymentOut);
    }
}

export class MyInvoicePaymentsUseCase {
    constructor(private readonly d: Dependencies) {}
    /* An invoice that is not one of my children's issued invoices is "not found", never "forbidden", so nothing about it is confirmed. */
    async execute(v: Viewer, invoiceId: string) {
        const invoice = await this.d.feeReportRepository.invoiceForPayments(invoiceId);
        const mine = invoice && invoice.status !== "draft" && invoice.status !== "void" && (await myStudentIds(this.d, v)).includes(invoice.studentId);
        if (!mine) throw feeErrors.invoiceNotFound();
        return (await this.d.feeReportRepository.invoicePayments(invoiceId)).map(familyInvoicePaymentOut);
    }
}
