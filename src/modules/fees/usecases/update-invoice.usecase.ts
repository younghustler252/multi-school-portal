import { IFeeRepository } from "../repositories/fee.repository";
import { NotFoundError }  from "../../../shared/errors/domain.errors";
import { FeeErrorMessage } from "../domain/fee.enums";
import { UpdateInvoiceDtoType } from "../dtos/fee.dto";

interface Dependencies { feeRepository: IFeeRepository; }

export class UpdateInvoiceUseCase {
    private readonly feeRepository: IFeeRepository;
    constructor({ feeRepository }: Dependencies) { this.feeRepository = feeRepository; }

    async execute(invoiceId: string, dto: UpdateInvoiceDtoType) {
        const invoice = await this.feeRepository.findInvoiceByIdEnriched(invoiceId);
        if (!invoice) throw new NotFoundError(FeeErrorMessage.INVOICE_NOT_FOUND);

        await this.feeRepository.updateInvoiceFields(invoiceId, {
            discountKobo: dto.discountKobo,
            dueDate:      dto.dueDate ? new Date(dto.dueDate) : undefined,
            note:         dto.note,
        });

        if (dto.discountKobo !== undefined) {
            await this.feeRepository.recalculateInvoiceStatus(invoiceId);
        }

        return this.feeRepository.findInvoiceByIdEnriched(invoiceId);
    }
}