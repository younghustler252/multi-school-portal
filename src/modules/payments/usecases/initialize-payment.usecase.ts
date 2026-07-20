import { IPaymentRepository }      from "../repositories/payment.repository";
import { IFeeRepository }          from "../../fees/repositories/fee.repository";
import { PaymentMapper }           from "../mappers/payment.mapper";
import { PaystackProvider }        from "../../../infrastructure/payments/paystack.provider";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import {
    NotFoundError,
    BadRequestError,
}                                  from "../../../shared/errors/domain.errors";
import { PaymentErrorMessage }     from "../domain/payment.enums";
import { InitializePaymentDtoType } from "../dtos/payment.dto";
import { v4 as uuidv4 }            from "uuid";

/*
|--------------------------------------------------------------------------
| INITIALIZE PAYMENT USE CASE
| Guardian initiates online payment via Paystack
| Flow:
| 1. Find invoice
| 2. Check not already fully paid
| 3. Get guardian email for Paystack
| 4. Initialize Paystack transaction
| 5. Create pending payment record
| 6. Return authorization URL for redirect
|--------------------------------------------------------------------------
*/

interface Dependencies {
    paymentRepository: IPaymentRepository;
    feeRepository:     IFeeRepository;
    userRepository:    IUserRepository;
    paymentMapper:     PaymentMapper;
    paymentProvider:   PaystackProvider;
}

export class InitializePaymentUseCase {
    private readonly paymentRepository: IPaymentRepository;
    private readonly feeRepository:     IFeeRepository;
    private readonly userRepository:    IUserRepository;
    private readonly paymentMapper:     PaymentMapper;
    private readonly paymentProvider:   PaystackProvider;

    constructor({
        paymentRepository,
        feeRepository,
        userRepository,
        paymentMapper,
        paymentProvider,
    }: Dependencies) {
        this.paymentRepository = paymentRepository;
        this.feeRepository     = feeRepository;
        this.userRepository    = userRepository;
        this.paymentMapper     = paymentMapper;
        this.paymentProvider   = paymentProvider;
    }

    async execute(
        dto:     InitializePaymentDtoType,
        userId:  string,
    ): Promise<{
        authorizationUrl: string;
        reference:        string;
        amountKobo:       number;
    }> {

        // ── 1. Find invoice ───────────────────────────────────────────────
        const invoice = await this.feeRepository.findInvoiceById(dto.invoiceId);
        if (!invoice) throw new NotFoundError(PaymentErrorMessage.INVOICE_NOT_FOUND);

        // ── 2. Check not already fully paid ──────────────────────────────
        if (invoice.status === "paid") {
            throw new BadRequestError(PaymentErrorMessage.ALREADY_PAID);
        }

        // ── 3. Get user email ─────────────────────────────────────────────
        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundError("User");

        // ── 4. Initialize Paystack ────────────────────────────────────────
        const reference = `PAY-${uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase()}`;

        const result = await this.paymentProvider.initializeTransaction({
            email:       user.email,
            amountKobo:  invoice.balanceKobo, // pay outstanding balance
            reference,
            callbackUrl: dto.callbackUrl,
            metadata: {
                invoiceId: invoice.id,
                userId,
            },
        });

        // ── 5. Create pending payment record ──────────────────────────────
        await this.paymentRepository.create({
            feeInvoiceId: invoice.id,
            guardianId:   null, // linked after webhook confirms
            amountKobo:   invoice.balanceKobo,
            method:       "paystack",
            reference:    result.reference,
            status:       "pending",
            webhookVerified: false,
        });

        // ── 6. Return authorization URL ───────────────────────────────────
        return {
            authorizationUrl: result.authorizationUrl,
            reference:        result.reference,
            amountKobo:       invoice.balanceKobo,
        };
    }
}