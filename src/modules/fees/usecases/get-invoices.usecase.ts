// GetInvoicesUseCase
import { IFeeRepository } from "../repositories/fee.repository";
import { ListInvoicesDtoType } from "../dtos/fee.dto";
import { parsePagination, buildPaginationMeta } from "../../../shared/utils/pagination";

interface Dependencies { feeRepository: IFeeRepository; }

export class GetInvoicesUseCase {
    private readonly feeRepository: IFeeRepository;
    constructor({ feeRepository }: Dependencies) { this.feeRepository = feeRepository; }

    async execute(dto: ListInvoicesDtoType) {
        const where: Record<string, any> = {};
        if (dto.studentId) where.studentId = dto.studentId;
        if (dto.termId)    where.termId    = dto.termId;
        if (dto.status)    where.status    = dto.status;

        const { page, limit, skip } = parsePagination({ page: Number(dto.page) || 1, limit: Number(dto.limit) || 20 });
        const { data, total } = await this.feeRepository.paginateInvoicesEnriched(where, skip, limit);

        return { data, meta: buildPaginationMeta(total, page, limit) };
    }
}