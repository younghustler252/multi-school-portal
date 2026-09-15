import { IPaymentRepository }    from "../repositories/payment.repository";
import { IFeeRepository }        from "../../fees/repositories/fee.repository";
import { IGuardianRepository }   from "../../guardians/repositories/guardian.repository";
import { ISchoolRepository }     from "../../school/repositories/school.repository";
import { PaymentMapper }         from "../mappers/payment.mapper";
import { PaymentResponseData }   from "../mappers/payment.mapper";
import { IPaymentProvider }      from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import { MailService }           from "../../../infrastructure/mail/mail.service";
import {
    NotFoundError,
}                                from "../../../shared/errors/domain.errors";
import { PaymentErrorMessage }   from "../domain/payment.enums";
import { VerifyPaymentDtoType }  from "../dtos/payment.dto";

interface Dependencies {
    paymentRepository:  IPaymentRepository;
    feeRepository:      IFeeRepository;
    guardianRepository: IGuardianRepository;
    schoolRepository:   ISchoolRepository;
    paymentMapper:      PaymentMapper;
    paymentProvider:    IPaymentProvider;
    mailService:        MailService;
}

export class VerifyPaymentUseCase {
    private readonly paymentRepository:  IPaymentRepository;
    private readonly feeRepository:      IFeeRepository;
    private readonly guardianRepository: IGuardianRepository;
    private readonly schoolRepository:   ISchoolRepository;
    private readonly paymentMapper:      PaymentMapper;
    private readonly paymentProvider:    IPaymentProvider;
    private readonly mailService:        MailService;

    constructor(deps: Dependencies) {
        this.paymentRepository  = deps.paymentRepository;
        this.feeRepository      = deps.feeRepository;
        this.guardianRepository = deps.guardianRepository;
        this.schoolRepository   = deps.schoolRepository;
        this.paymentMapper      = deps.paymentMapper;
        this.paymentProvider    = deps.paymentProvider;
        this.mailService        = deps.mailService;
    }

    async execute(dto: VerifyPaymentDtoType): Promise<PaymentResponseData> {

        const payment = await this.paymentRepository.findByReference(dto.reference);
        if (!payment) throw new NotFoundError(PaymentErrorMessage.NOT_FOUND);

        if (payment.webhookVerified && payment.status === "success") {
            return this.paymentMapper.toResponse(payment);
        }

        const verification = await this.paymentProvider.verifyTransaction(dto.reference);
        const isSuccess = verification.status === "success";

        // Resolve the guardian from the metadata stashed at initialization
        // time (InitializePaymentUseCase sends { invoiceId, userId, schoolId }
        // to Paystack, which echoes it back on verify).
        let guardianId: string | null = null;
        if (isSuccess && verification.metadata?.userId) {
            const guardian = await this.guardianRepository.findByUserId(verification.metadata.userId);
            guardianId = guardian?.id ?? null;
        }

        const updatedPayment = await this.paymentRepository.update(payment.id, {
            status:           isSuccess ? "success" : "failed",
            webhookVerified:  true,
            channel:          verification.channel,
            paidAt:           isSuccess ? new Date() : null,
            providerResponse: verification,
            guardianId:       guardianId ?? undefined,
        });

        if (isSuccess) {
            await this.feeRepository.recalculateInvoiceStatus(payment.feeInvoiceId);

            const school = verification.metadata?.schoolId
                ? await this.schoolRepository.findById(verification.metadata.schoolId)
                : null;

            const guardian = guardianId
                ? await this.guardianRepository.findById(guardianId)
                : null;

            await this.mailService.sendPaymentReceipt({
                to:         verification.customerEmail,
                firstName:  guardian?.firstName ?? "there",
                schoolName: school?.name ?? "your school",
                amount:     `₦${(payment.amountKobo / 100).toLocaleString()}`,
                reference:  dto.reference,
                date:       new Date().toLocaleDateString("en-NG"),
            });
        }

        return this.paymentMapper.toResponse(updatedPayment);
    }
}