import { IPaymentRepository } from "../repositories/payment.repository";
import { IPaymentContextRepository } from "../repositories/payment-context.repository";
import { familyInvoiceHistory, staffInvoiceHistory } from "../services/invoice-payment-history";

interface Dependencies { paymentRepository: IPaymentRepository; paymentContextRepository: IPaymentContextRepository }

/* GET /payments/by-invoice/:invoiceId (payments.view): the whole history of one invoice. An invoice with no payments gives an empty list. */
export class InvoicePaymentHistoryUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(invoiceId: string) {
        return staffInvoiceHistory(invoiceId, await this.d.paymentRepository.listForInvoice(invoiceId));
    }
}

/* GET /payments/my/by-invoice/:invoiceId (payments.pay): a guardian's view; empty unless the invoice is a linked child's. */
export class MyInvoicePaymentHistoryUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(invoiceId: string, guardianId: string) {
        const childIds = new Set(await this.d.paymentContextRepository.guardianLinkedStudentIds(guardianId));
        return familyInvoiceHistory(invoiceId, await this.d.paymentRepository.listForInvoice(invoiceId), guardianId, childIds);
    }
}
