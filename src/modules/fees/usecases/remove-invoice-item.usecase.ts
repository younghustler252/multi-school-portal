import { IFeeRepository } from "../repositories/fee.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors/domain.errors";

interface Dependencies { feeRepository: IFeeRepository; }

export class RemoveInvoiceItemUseCase {
    private readonly feeRepository: IFeeRepository;
    constructor({ feeRepository }: Dependencies) { this.feeRepository = feeRepository; }
    // RemoveInvoiceItemUseCase
    async execute(itemId: string) {
        const item = await this.feeRepository.findInvoiceItemById(itemId);
        if (!item) throw new NotFoundError("Invoice item not found");

        const invoice = await this.feeRepository.findInvoiceByIdEnriched(item.feeInvoiceId);
        if (invoice && invoice.items.length <= 1) {
            throw new BadRequestError("Cannot remove the last item on an invoice. Delete the invoice instead.");
        }
        if (invoice && invoice.paidKobo > 0) {
            throw new BadRequestError("Cannot remove an item once a payment has been recorded against this invoice.");
        }

        await this.feeRepository.deleteInvoiceItem(itemId); // hard delete still fine here — genuinely pre-payment only
        await this.feeRepository.recalculateInvoiceStatus(item.feeInvoiceId);

        return this.feeRepository.findInvoiceByIdEnriched(item.feeInvoiceId);
    }
}