import { IFeeRepository }        from "../repositories/fee.repository";
import { FeeInvoiceMapper }      from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { ListInvoicesDtoType }    from "../dtos/fee.dto";

interface Dependencies {
    feeRepository:    IFeeRepository;
    feeInvoiceMapper: FeeInvoiceMapper;
}

export class GetInvoicesUseCase {
    private readonly feeRepository:    IFeeRepository;
    private readonly feeInvoiceMapper: FeeInvoiceMapper;

    constructor({ feeRepository, feeInvoiceMapper }: Dependencies) {
        this.feeRepository    = feeRepository;
        this.feeInvoiceMapper = feeInvoiceMapper;
    }

    async execute(
        dto: ListInvoicesDtoType,
    ): Promise<PaginatedResult<FeeInvoiceResponseData>> {
        const where: Record<string, any> = {};

        if (dto.studentId) where.studentId = dto.studentId;
        if (dto.termId)    where.termId    = dto.termId;
        if (dto.feeTypeId) where.feeTypeId = dto.feeTypeId;
        if (dto.status)    where.status    = dto.status;

        const result = await this.feeRepository.paginateInvoices({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(i => this.feeInvoiceMapper.toResponse(i)),
            meta: result.meta,
        };
    }
}