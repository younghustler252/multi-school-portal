import { IFeeRepository } from "../repositories/fee.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors/domain.errors";

interface Dependencies { feeRepository: IFeeRepository; }

export class RemoveInvoiceItemUseCase {
    private readonly feeRepository: IFeeRepository;
    constructor({ feeRepository }: Dependencies) { this.feeRepository = feeRepository; }

    async execute(itemId: string) {
        const item = await this.feeRepository.findInvoiceItemById(itemId);
        if (!item) throw new NotFoundError("Invoice item not found");

        const invoice = await this.feeRepository.findInvoiceByIdEnriched(item.feeInvoiceId);
        if (invoice && invoice.items.length <= 1) {
            throw new BadRequestError("Cannot remove the last item on an invoice. Delete the invoice instead.");
        }

        await this.feeRepository.deleteInvoiceItem(itemId);
        await this.feeRepository.recalculateInvoiceStatus(item.feeInvoiceId);

        return this.feeRepository.findInvoiceByIdEnriched(item.feeInvoiceId);
    }
}