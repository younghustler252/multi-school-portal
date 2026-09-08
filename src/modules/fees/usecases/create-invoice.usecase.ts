// CreateInvoiceUseCase
import { IFeeRepository } from "../repositories/fee.repository";
import { ConflictError } from "../../../shared/errors/domain.errors";
import { CreateInvoiceDtoType } from "../dtos/fee.dto";

interface Dependencies { feeRepository: IFeeRepository; }

export class CreateInvoiceUseCase {
    private readonly feeRepository: IFeeRepository;
    constructor({ feeRepository }: Dependencies) { this.feeRepository = feeRepository; }

    async execute(dto: CreateInvoiceDtoType) {
        const existing = await this.feeRepository.findInvoiceByStudentAndTerm(dto.studentId, dto.termId);
        if (existing) throw new ConflictError("An invoice already exists for this student this term. Add items to it instead.");

        return this.feeRepository.createInvoice(
            dto.studentId,
            dto.termId,
            dto.items,
            dto.dueDate ? new Date(dto.dueDate) : undefined,
            dto.note,
        );
    }
}