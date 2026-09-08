// GetInvoiceByIdUseCase
import { IFeeRepository } from "../repositories/fee.repository";
import { NotFoundError } from "../../../shared/errors/domain.errors";

interface Dependencies { feeRepository: IFeeRepository; }

export class GetInvoiceByIdUseCase {
    private readonly feeRepository: IFeeRepository;
    constructor({ feeRepository }: Dependencies) { this.feeRepository = feeRepository; }

    async execute(id: string) {
        const invoice = await this.feeRepository.findInvoiceByIdEnriched(id);
        if (!invoice) throw new NotFoundError("Invoice not found");
        return invoice;
    }
}