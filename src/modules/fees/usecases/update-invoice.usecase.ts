import { IFeeRepository }       from "../repositories/fee.repository";
import { FeeInvoiceMapper }     from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import { NotFoundError }        from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }      from "../domain/fee.enums";
import { UpdateInvoiceDtoType } from "../dtos/fee.dto";

interface Dependencies {
    feeRepository:    IFeeRepository;
    feeInvoiceMapper: FeeInvoiceMapper;
}

export class UpdateInvoiceUseCase {
    private readonly feeRepository:    IFeeRepository;
    private readonly feeInvoiceMapper: FeeInvoiceMapper;

    constructor({ feeRepository, feeInvoiceMapper }: Dependencies) {
        this.feeRepository    = feeRepository;
        this.feeInvoiceMapper = feeInvoiceMapper;
    }

    async execute(
        id:  string,
        dto: UpdateInvoiceDtoType,
    ): Promise<FeeInvoiceResponseData> {
        const invoice = await this.feeRepository.findInvoiceById(id);
        if (!invoice) throw new NotFoundError(FeeErrorMessage.INVOICE_NOT_FOUND);

        const updateData: Record<string, any> = { ...dto };
        if (dto.dueDate) updateData.dueDate = new Date(dto.dueDate);

        // Recalculate balance if amount changed
        if (dto.amountKobo) {
            updateData.balanceKobo = dto.amountKobo - invoice.paidKobo;
        }

        const updated = await this.feeRepository.updateInvoice(id, updateData);
        return this.feeInvoiceMapper.toResponse(updated);
    }
}