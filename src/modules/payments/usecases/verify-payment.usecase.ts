import { IPaymentRepository }    from "../repositories/payment.repository";
import { IFeeRepository }        from "../../fees/repositories/fee.repository";
import { PaymentMapper }         from "../mappers/payment.mapper";
import { PaymentResponseData }   from "../mappers/payment.mapper";
import { PaystackProvider }      from "../../../infrastructure/payments/paystack.provider";
import { MailService }           from "../../../infrastructure/mail/mail.service";
import {
    NotFoundError,
    BadRequestError,
}                                from "../../../shared/errors/domain.errors";
import { PaymentErrorMessage }   from "../domain/payment.enums";
import { VerifyPaymentDtoType }  from "../dtos/payment.dto";

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT USE CASE
| Called after Paystack redirect callback
| Also used by webhook handler
| Flow:
| 1. Find payment by reference
| 2. Verify with Paystack API
| 3. Update payment status
| 4. Update invoice paidKobo + balanceKobo + status
| 5. Send payment receipt email
|--------------------------------------------------------------------------
*/

interface Dependencies {
    paymentRepository: IPaymentRepository;
    feeRepository:     IFeeRepository;
    paymentMapper:     PaymentMapper;
    paymentProvider:   PaystackProvider;
    mailService:       MailService;
}

export class VerifyPaymentUseCase {
    private readonly paymentRepository: IPaymentRepository;
    private readonly feeRepository:     IFeeRepository;
    private readonly paymentMapper:     PaymentMapper;
    private readonly paymentProvider:   PaystackProvider;
    private readonly mailService:       MailService;

    constructor({
        paymentRepository,
        feeRepository,
        paymentMapper,
        paymentProvider,
        mailService,
    }: Dependencies) {
        this.paymentRepository = paymentRepository;
        this.feeRepository     = feeRepository;
        this.paymentMapper     = paymentMapper;
        this.paymentProvider   = paymentProvider;
        this.mailService       = mailService;
    }

    async execute(
        dto: VerifyPaymentDtoType,
    ): Promise<PaymentResponseData> {

        // ── 1. Find payment by reference ──────────────────────────────────
        const payment = await this.paymentRepository
            .findByReference(dto.reference);

        if (!payment) {
            throw new NotFoundError(PaymentErrorMessage.NOT_FOUND);
        }

        // ── Skip if already verified ──────────────────────────────────────
        if (payment.webhookVerified && payment.status === "success") {
            return this.paymentMapper.toResponse(payment);
        }

        // ── 2. Verify with Paystack ───────────────────────────────────────
        const verification = await this.paymentProvider.verifyTransaction(
            dto.reference,
        );

        const isSuccess = verification.status === "success";

        // ── 3. Update payment record ──────────────────────────────────────
        const updatedPayment = await this.paymentRepository.update(
            payment.id,
            {
                status:          isSuccess ? "success" : "failed",
                webhookVerified: true,
                channel:         verification.channel,
                paidAt:          isSuccess ? new Date() : null,
                providerResponse: verification,
            },
        );

        // ── 4. Update invoice if successful ───────────────────────────────
        if (isSuccess) {
            const invoice = await this.feeRepository.findInvoiceById(
                payment.feeInvoiceId,
            );

            if (invoice) {
                const newPaidKobo    = invoice.paidKobo + payment.amountKobo;
                const newBalanceKobo = invoice.amountKobo - newPaidKobo;
                const newStatus      = newBalanceKobo <= 0 ? "paid" : "partial";

                await this.feeRepository.updateInvoice(invoice.id, {
                    paidKobo:    newPaidKobo,
                    balanceKobo: Math.max(0, newBalanceKobo),
                    status:      newStatus,
                });

                // ── 5. Send receipt email ─────────────────────────────────
                await this.mailService.sendPaymentReceipt({
                    to:         verification.customerEmail,
                    firstName:  "Parent",
                    schoolName: "School",
                    amount:     `₦${(payment.amountKobo / 100).toLocaleString()}`,
                    reference:  dto.reference,
                    date:       new Date().toLocaleDateString("en-NG"),
                });
            }
        }

        return this.paymentMapper.toResponse(updatedPayment);
    }
}