import { IPaymentRepository }      from "../repositories/payment.repository";
import { IFeeRepository }          from "../../fees/repositories/fee.repository";
import { ISchoolRepository }       from "../../school/repositories/school.repository";
import { PaymentMapper }           from "../mappers/payment.mapper";
import { IPaymentProvider }        from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import {
    NotFoundError,
    BadRequestError,
}                                  from "../../../shared/errors/domain.errors";
import { PaymentErrorMessage }     from "../domain/payment.enums";
import { InitializePaymentDtoType } from "../dtos/payment.dto";
import { v4 as uuidv4 }            from "uuid";

interface Dependencies {
    paymentRepository: IPaymentRepository;
    feeRepository:     IFeeRepository;
    schoolRepository:  ISchoolRepository;
    userRepository:    IUserRepository;
    paymentMapper:     PaymentMapper;
    paymentProvider:   IPaymentProvider;
}

export class InitializePaymentUseCase {
    private readonly paymentRepository: IPaymentRepository;
    private readonly feeRepository:     IFeeRepository;
    private readonly schoolRepository:  ISchoolRepository;
    private readonly userRepository:    IUserRepository;
    private readonly paymentMapper:     PaymentMapper;
    private readonly paymentProvider:   IPaymentProvider;

    constructor({
        paymentRepository,
        feeRepository,
        schoolRepository,
        userRepository,
        paymentMapper,
        paymentProvider,
    }: Dependencies) {
        this.paymentRepository = paymentRepository;
        this.feeRepository     = feeRepository;
        this.schoolRepository  = schoolRepository;
        this.userRepository    = userRepository;
        this.paymentMapper     = paymentMapper;
        this.paymentProvider   = paymentProvider;
    }

    async execute(
        dto:      InitializePaymentDtoType,
        userId:   string,
        schoolId: string,
    ): Promise<{
        authorizationUrl: string;
        reference:        string;
        amountKobo:       number;
    }> {

        const invoice = await this.feeRepository.findInvoiceById(dto.invoiceId);
        if (!invoice) throw new NotFoundError(PaymentErrorMessage.INVOICE_NOT_FOUND);

        if (invoice.status === "paid") {
            throw new BadRequestError(PaymentErrorMessage.ALREADY_PAID);
        }

        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundError("User");

        const school = await this.schoolRepository.findById(schoolId);
        if (!school) throw new NotFoundError("School");

        const reference = `PAY-${uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase()}`;

        const result = await this.paymentProvider.initializeTransaction({
            email:       user.email,
            amountKobo:  invoice.balanceKobo,
            reference,
            callbackUrl: dto.callbackUrl,
            subaccount:  school.paystackSubaccountCode ?? undefined,
            metadata: {
                invoiceId: invoice.id,
                userId,
                schoolId,
            },
        });

        await this.paymentRepository.create({
            feeInvoiceId: invoice.id,
            guardianId:   null,
            amountKobo:   invoice.balanceKobo,
            method:       "paystack",
            reference:    result.reference,
            status:       "pending",
            webhookVerified: false,
        });

        return {
            authorizationUrl: result.authorizationUrl,
            reference:        result.reference,
            amountKobo:       invoice.balanceKobo,
        };
    }
}