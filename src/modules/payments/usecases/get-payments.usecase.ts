import { IPaymentRepository }  from "../repositories/payment.repository";
import { PaymentMapper }       from "../mappers/payment.mapper";
import { PaymentResponseData } from "../mappers/payment.mapper";
import { PaginatedResult }     from "../../../infrastructure/repository/base.repository";
import { ListPaymentsDtoType } from "../dtos/payment.dto";

interface Dependencies {
    paymentRepository: IPaymentRepository;
    paymentMapper:     PaymentMapper;
}

export class GetPaymentsUseCase {
    private readonly paymentRepository: IPaymentRepository;
    private readonly paymentMapper:     PaymentMapper;

    constructor({ paymentRepository, paymentMapper }: Dependencies) {
        this.paymentRepository = paymentRepository;
        this.paymentMapper     = paymentMapper;
    }

    async execute(
        dto: ListPaymentsDtoType,
    ): Promise<PaginatedResult<PaymentResponseData>> {
        const where: Record<string, any> = {};

        if (dto.invoiceId)  where.feeInvoiceId = dto.invoiceId;
        if (dto.guardianId) where.guardianId   = dto.guardianId;
        if (dto.status)     where.status       = dto.status;
        if (dto.method)     where.method       = dto.method;

        if (dto.startDate && dto.endDate) {
            where.createdAt = {
                gte: new Date(dto.startDate),
                lte: new Date(dto.endDate),
            };
        }

        const result = await this.paymentRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(p => this.paymentMapper.toResponse(p)),
            meta: result.meta,
        };
    }
}