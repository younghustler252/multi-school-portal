import { IFeeRepository } from "../repositories/fee.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors/domain.errors";

interface Dependencies { feeRepository: IFeeRepository; }

export class UpdateInvoiceItemUseCase {
    private readonly feeRepository: IFeeRepository;
    constructor({ feeRepository }: Dependencies) { this.feeRepository = feeRepository; }

    async execute(itemId: string, amountKobo: number) {
        if (amountKobo <= 0) throw new BadRequestError("Amount must be positive.");

        const item = await this.feeRepository.findInvoiceItemById(itemId);
        if (!item) throw new NotFoundError("Invoice item not found");

        await this.feeRepository.updateInvoiceItem(itemId, amountKobo);
        await this.feeRepository.recalculateInvoiceStatus(item.feeInvoiceId);

        return this.feeRepository.findInvoiceByIdEnriched(item.feeInvoiceId);
    }
}