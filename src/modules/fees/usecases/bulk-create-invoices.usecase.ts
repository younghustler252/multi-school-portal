import { IFeeRepository }           from "../repositories/fee.repository";
import { BulkCreateInvoiceDtoType } from "../dtos/fee.dto";

interface Dependencies {
    feeRepository: IFeeRepository;
}

export class BulkCreateInvoicesUseCase {
    private readonly feeRepository: IFeeRepository;

    constructor({ feeRepository }: Dependencies) {
        this.feeRepository = feeRepository;
    }

    async execute(dto: BulkCreateInvoiceDtoType) {
        const created: any[]    = [];
        const skipped: string[] = [];

        for (const studentId of dto.studentIds) {
            const existing = await this.feeRepository.findInvoiceByStudentAndTerm(studentId, dto.termId);

            if (existing) {
                skipped.push(studentId);
                continue;
            }

            const invoice = await this.feeRepository.createInvoice(
                studentId,
                dto.termId,
                dto.items,
                dto.dueDate ? new Date(dto.dueDate) : undefined,
            );

            created.push(invoice);
        }

        return { created, skipped };
    }
}