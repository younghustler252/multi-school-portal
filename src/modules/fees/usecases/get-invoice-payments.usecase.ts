import { IFeeRepository } from "../repositories/fee.repository";
import { PaymentMapper }  from "../../payments/mappers/payment.mapper";
import { NotFoundError }  from "../../../shared/errors/domain.errors";

interface Dependencies {
    feeRepository: IFeeRepository;
    paymentMapper: PaymentMapper;
}

export class GetInvoicePaymentsUseCase {
    private readonly feeRepository: IFeeRepository;
    private readonly paymentMapper: PaymentMapper;

    constructor({ feeRepository, paymentMapper }: Dependencies) {
        this.feeRepository = feeRepository;
        this.paymentMapper = paymentMapper;
    }

    async execute(invoiceId: string) {
        const invoice = await this.feeRepository.findInvoiceByIdEnriched(invoiceId);
        if (!invoice) throw new NotFoundError("Invoice not found");

        const payments = await this.feeRepository.findPaymentsByInvoiceId(invoiceId);
        return payments.map(p => this.paymentMapper.toResponse(p));
    }
}