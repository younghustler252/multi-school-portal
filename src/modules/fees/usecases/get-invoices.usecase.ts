import { IFeeRepository }      from "../repositories/fee.repository";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import { PaginatedResult }     from "../../../infrastructure/repository/base.repository";
import { ListInvoicesDtoType } from "../dtos/fee.dto";
import { parsePagination, buildPaginationMeta } from "../../../shared/utils/pagination";

interface Dependencies {
    feeRepository: IFeeRepository;
}

export class GetInvoicesUseCase {
    private readonly feeRepository: IFeeRepository;

    constructor({ feeRepository }: Dependencies) {
        this.feeRepository = feeRepository;
    }

    async execute(
        dto: ListInvoicesDtoType,
    ): Promise<PaginatedResult<FeeInvoiceResponseData>> {
        const where: Record<string, any> = {};

        if (dto.studentId) where.studentId = dto.studentId;
        if (dto.termId)    where.termId    = dto.termId;
        if (dto.feeTypeId) where.feeTypeId = dto.feeTypeId;
        if (dto.status)    where.status    = dto.status;

        const { page, limit, skip } = parsePagination({
            page:  Number(dto.page)  || 1,
            limit: Number(dto.limit) || 20,
        });

        const [data, total] = await Promise.all([
            this.feeRepository.findManyInvoicesEnriched(where, skip, limit),
            this.feeRepository.countInvoices(where),
        ]);

        return {
            data,
            meta: buildPaginationMeta(total, page, limit),
        };
    }
}