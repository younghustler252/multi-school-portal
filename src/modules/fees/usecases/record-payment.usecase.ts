import { IFeeRepository }        from "../repositories/fee.repository";
import { FeeInvoiceMapper }      from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import {
    NotFoundError,
    BadRequestError,
}                                from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }       from "../domain/fee.enums";

/*
|--------------------------------------------------------------------------
| RECORD PAYMENT USE CASE
| Bursar records a manual cash/bank transfer payment
| Supports installments — partial payments allowed
| Updates paidKobo, balanceKobo, and status on the invoice
|--------------------------------------------------------------------------
*/

interface Dependencies {
    feeRepository:    IFeeRepository;
    feeInvoiceMapper: FeeInvoiceMapper;
}

export class RecordPaymentUseCase {
    private readonly feeRepository:    IFeeRepository;
    private readonly feeInvoiceMapper: FeeInvoiceMapper;

    constructor({ feeRepository, feeInvoiceMapper }: Dependencies) {
        this.feeRepository    = feeRepository;
        this.feeInvoiceMapper = feeInvoiceMapper;
    }

    async execute(params: {
        invoiceId:    string;
        amountKobo:   number;
        recordedById: string;
        note?:        string;
    }): Promise<FeeInvoiceResponseData> {

        // ── Find invoice ──────────────────────────────────────────────────
        const invoice = await this.feeRepository.findInvoiceById(
            params.invoiceId,
        );
        if (!invoice) throw new NotFoundError(FeeErrorMessage.INVOICE_NOT_FOUND);

        // ── Check not overpaying ──────────────────────────────────────────
        if (params.amountKobo > invoice.balanceKobo) {
            throw new BadRequestError(
                `Payment of ₦${params.amountKobo / 100} exceeds outstanding balance of ₦${invoice.balanceKobo / 100}`,
            );
        }

        // ── Calculate new amounts ─────────────────────────────────────────
        const newPaidKobo    = invoice.paidKobo + params.amountKobo;
        const newBalanceKobo = invoice.amountKobo - newPaidKobo;

        // ── Determine new status ──────────────────────────────────────────
        let newStatus = "partial";
        if (newBalanceKobo === 0) newStatus = "paid";
        if (newPaidKobo    === 0) newStatus = "unpaid";

        // ── Update invoice ────────────────────────────────────────────────
        const updated = await this.feeRepository.updateInvoice(
            params.invoiceId,
            {
                paidKobo:    newPaidKobo,
                balanceKobo: newBalanceKobo,
                status:      newStatus,
                note:        params.note,
            },
        );

        return this.feeInvoiceMapper.toResponse(updated);
    }
}