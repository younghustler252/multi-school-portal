import { IFeeRepository }         from "../repositories/fee.repository";
import { FeeInvoiceMapper }       from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import { NotFoundError }          from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }        from "../domain/fee.enums";

interface Dependencies {
    feeRepository:    IFeeRepository;
    feeInvoiceMapper: FeeInvoiceMapper;
}

export class GetInvoiceByIdUseCase {
    private readonly feeRepository:    IFeeRepository;
    private readonly feeInvoiceMapper: FeeInvoiceMapper;

    constructor({ feeRepository, feeInvoiceMapper }: Dependencies) {
        this.feeRepository    = feeRepository;
        this.feeInvoiceMapper = feeInvoiceMapper;
    }

    async execute(id: string): Promise<FeeInvoiceResponseData> {
        const invoice = await this.feeRepository.findInvoiceById(id);
        if (!invoice) throw new NotFoundError(FeeErrorMessage.INVOICE_NOT_FOUND ?? "Invoice not found");
        return this.feeInvoiceMapper.toResponse(invoice);
    }
}