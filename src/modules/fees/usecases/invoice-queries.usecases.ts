import { IFeeInvoiceRepository } from "../repositories/fee-invoice.repository";
import { FeeInvoiceMapper } from "../mappers/fee-invoice.mapper";
import { feeErrors } from "../domain/fee.errors";
import { ListInvoicesQueryType } from "../dtos/invoice.dto";

interface Dependencies { feeInvoiceRepository: IFeeInvoiceRepository; feeInvoiceMapper: FeeInvoiceMapper }

export class ListInvoicesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: ListInvoicesQueryType) {
        const { page, limit, ...filters } = q;
        const r = await this.d.feeInvoiceRepository.list(filters, page, limit);
        return { data: r.data.map(i => this.d.feeInvoiceMapper.toSummary(i)), meta: r.meta };
    }
}

export class GetInvoiceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string) {
        const inv = await this.d.feeInvoiceRepository.findById(id);
        if (!inv) throw feeErrors.invoiceNotFound();
        return this.d.feeInvoiceMapper.toResponse(inv);
    }
}
