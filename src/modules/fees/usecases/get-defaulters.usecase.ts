import { IFeeRepository }        from "../repositories/fee.repository";
import { FeeInvoiceMapper }      from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";

interface Dependencies {
    feeRepository:    IFeeRepository;
    feeInvoiceMapper: FeeInvoiceMapper;
}

export class GetDefaultersUseCase {
    private readonly feeRepository:    IFeeRepository;
    private readonly feeInvoiceMapper: FeeInvoiceMapper;

    constructor({ feeRepository, feeInvoiceMapper }: Dependencies) {
        this.feeRepository    = feeRepository;
        this.feeInvoiceMapper = feeInvoiceMapper;
    }

    async execute(termId: string): Promise<FeeInvoiceResponseData[]> {
        const invoices = await this.feeRepository.findDefaultersByTerm(termId);
        return invoices.map(i => this.feeInvoiceMapper.toResponse(i));
    }
}