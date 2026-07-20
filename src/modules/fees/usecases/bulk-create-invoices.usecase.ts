import { IFeeRepository }           from "../repositories/fee.repository";
import { FeeInvoiceMapper }         from "../mappers/fee.mapper";
import { FeeInvoiceResponseData }   from "../mappers/fee.mapper";
import { NotFoundError }            from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }          from "../domain/fee.enums";
import { BulkCreateInvoiceDtoType } from "../dtos/fee.dto";

interface Dependencies {
    feeRepository:    IFeeRepository;
    feeInvoiceMapper: FeeInvoiceMapper;
}

export class BulkCreateInvoicesUseCase {
    private readonly feeRepository:    IFeeRepository;
    private readonly feeInvoiceMapper: FeeInvoiceMapper;

    constructor({ feeRepository, feeInvoiceMapper }: Dependencies) {
        this.feeRepository    = feeRepository;
        this.feeInvoiceMapper = feeInvoiceMapper;
    }

    async execute(dto: BulkCreateInvoiceDtoType): Promise<{
        created: FeeInvoiceResponseData[];
        skipped: string[];
    }> {
        const feeType = await this.feeRepository.findFeeTypeById(dto.feeTypeId);
        if (!feeType) throw new NotFoundError(FeeErrorMessage.FEE_TYPE_NOT_FOUND);

        const created: FeeInvoiceResponseData[] = [];
        const skipped: string[]                 = [];

        for (const studentId of dto.studentIds) {
            const existing = await this.feeRepository.findInvoice({
                studentId,
                termId:    dto.termId,
                feeTypeId: dto.feeTypeId,
            });

            if (existing) {
                skipped.push(studentId);
                continue;
            }

            const invoice = await this.feeRepository.createInvoice({
                studentId,
                termId:      dto.termId,
                feeTypeId:   dto.feeTypeId,
                amountKobo:  dto.amountKobo,
                paidKobo:    0,
                balanceKobo: dto.amountKobo,
                status:      "unpaid",
                dueDate:     dto.dueDate ? new Date(dto.dueDate) : null,
            });

            created.push(this.feeInvoiceMapper.toResponse(invoice));
        }

        return { created, skipped };
    }
}