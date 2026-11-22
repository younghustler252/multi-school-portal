/*
| Payments applied to one invoice (the invoice screen's payment history). Only confirmed payments, newest first.
| A payment can be split over several invoices, so `allocatedKobo` is the part that went to THIS invoice.
| Money is whole kobo: a JSON number when safe, otherwise a digit string.
|
| STAFF   GET /fees/invoices/:id/payments        needs fees.invoices.view AND payments.view (and the fees plan feature)  -> StaffInvoicePayment[]
| FAMILY  GET /fees/my/invoices/:id/payments     needs fees.view; the invoice must be an issued invoice of the viewer's own child -> FamilyInvoicePayment[]
| Errors: 404 for an unknown invoice, and for the family route also another family's invoice or a draft/void one (never 403);
|         403 when a permission or the fees feature is missing; 401.
| Full contract: docs/api/contract-additions/invoice-payments.md
*/
export type KoboValue = number | string;
export type InvoicePaymentMethod = "paystack" | "flutterwave" | "bank_transfer" | "cash" | "cheque" | "pos" | "other";

export interface StaffInvoicePayment {
    paymentId: string;
    receiptNumber: string | null;
    method: InvoicePaymentMethod;
    status: "CONFIRMED";
    reference: string | null;
    /** yyyy-mm-dd */
    paidOn: string | null;
    /** ISO timestamp the payment was recorded */
    recordedAt: string;
    allocatedKobo: KoboValue;
    paymentTotalKobo: KoboValue;
}

/** No payer identity, gateway reference, notes or payment total. */
export interface FamilyInvoicePayment {
    paymentId: string;
    receiptNumber: string | null;
    method: InvoicePaymentMethod;
    status: "CONFIRMED";
    paidOn: string | null;
    allocatedKobo: KoboValue;
}
