import { IFeeRepository }     from "../repositories/fee.repository";
import { IPaymentRepository } from "../../payments/repositories/payment.repository";
import { AuditService }       from "../../audit/services/audit.service";
import {
    NotFoundError,
    BadRequestError,
}                              from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }    from "../domain/fee.enums";

interface Dependencies {
    feeRepository:     IFeeRepository;
    paymentRepository: IPaymentRepository;
    auditService:      AuditService;
}

export class RecordPaymentUseCase {
    private readonly feeRepository:     IFeeRepository;
    private readonly paymentRepository: IPaymentRepository;
    private readonly auditService:       AuditService;

    constructor({
        feeRepository,
        paymentRepository,
        auditService,
    }: Dependencies) {
        this.feeRepository     = feeRepository;
        this.paymentRepository = paymentRepository;
        this.auditService      = auditService;
    }

    async execute(params: {
        invoiceId:    string;
        amountKobo:   number;
        method:       "cash" | "bank_transfer";
        recordedById: string;
        note?:        string;
    }) {

        // ── Find invoice ──────────────────────────────────────────────────
        const invoice = await this.feeRepository.findInvoiceByIdEnriched(params.invoiceId);
        if (!invoice) throw new NotFoundError(FeeErrorMessage.INVOICE_NOT_FOUND);

        // ── Check payment does not exceed balance ─────────────────────────
        if (params.amountKobo > invoice.balanceKobo) {
            throw new BadRequestError(
                `Payment of ₦${params.amountKobo / 100} exceeds outstanding balance of ₦${invoice.balanceKobo / 100}`,
            );
        }

        const oldBalanceKobo = invoice.balanceKobo;
        const oldStatus      = invoice.status;

        // ── Record payment ────────────────────────────────────────────────
        const payment = await this.paymentRepository.create({
            feeInvoiceId:     params.invoiceId,
            guardianId:       null,
            amountKobo:       params.amountKobo,
            method:            params.method,
            status:            "success",
            webhookVerified:  false, // manual entry, not a provider webhook — recordedById is the trust source instead
            recordedById:      params.recordedById,
            paidAt:            new Date(),
        });

        // ── Recalculate invoice status ────────────────────────────────────
        await this.feeRepository.recalculateInvoiceStatus(params.invoiceId);

        const updatedInvoice = await this.feeRepository
            .findInvoiceByIdEnriched(params.invoiceId);

        // ── Audit manual payment ──────────────────────────────────────────
        await this.auditService.log({
            userId:   params.recordedById,
            action:   "payment.recorded",
            entity:   "Payment",
            entityId: payment.id,
            oldValue: {
                invoiceId:    params.invoiceId,
                balanceKobo:  oldBalanceKobo,
                status:       oldStatus,
            },
            newValue: {
                paymentId:    payment.id,
                invoiceId:    params.invoiceId,
                amountKobo:   params.amountKobo,
                method:       params.method,
                balanceKobo:  updatedInvoice?.balanceKobo ?? null,
                status:       updatedInvoice?.status ?? null,
            },
            metadata: {
                recordedById: params.recordedById,
                note:         params.note ?? null,
                manualEntry:  true,
            },
        });

        return updatedInvoice;
    }
}
