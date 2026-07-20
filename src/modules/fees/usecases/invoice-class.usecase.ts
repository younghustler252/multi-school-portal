import { IFeeRepository }       from "../repositories/fee.repository";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { FeeInvoiceMapper }     from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import { NotFoundError }        from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }      from "../domain/fee.enums";
import { InvoiceClassDtoType }  from "../dtos/fee.dto";

/*
|--------------------------------------------------------------------------
| INVOICE CLASS USE CASE
| Creates invoices for ALL enrolled students in a class
| Each class can have a different amount for the same fee type
|--------------------------------------------------------------------------
*/

interface Dependencies {
    feeRepository:       IFeeRepository;
    enrolmentRepository: IEnrolmentRepository;
    feeInvoiceMapper:    FeeInvoiceMapper;
}

export class InvoiceClassUseCase {
    private readonly feeRepository:       IFeeRepository;
    private readonly enrolmentRepository: IEnrolmentRepository;
    private readonly feeInvoiceMapper:    FeeInvoiceMapper;

    constructor({
        feeRepository,
        enrolmentRepository,
        feeInvoiceMapper,
    }: Dependencies) {
        this.feeRepository       = feeRepository;
        this.enrolmentRepository = enrolmentRepository;
        this.feeInvoiceMapper    = feeInvoiceMapper;
    }

    async execute(dto: InvoiceClassDtoType): Promise<{
        created: FeeInvoiceResponseData[];
        skipped: string[];
    }> {

        // ── Validate fee type ─────────────────────────────────────────────
        const feeType = await this.feeRepository.findFeeTypeById(dto.feeTypeId);
        if (!feeType) throw new NotFoundError(FeeErrorMessage.FEE_TYPE_NOT_FOUND);

        // ── Get all active enrolments for this class + term ───────────────
        const enrolments = await this.enrolmentRepository.findMany({
            classId: dto.classId,
            termId:  dto.termId,
            status:  "active",
        });

        const created: FeeInvoiceResponseData[] = [];
        const skipped: string[]                 = [];

        for (const enrolment of enrolments) {
            // Skip if already invoiced
            const existing = await this.feeRepository.findInvoice({
                studentId: enrolment.studentId,
                termId:    dto.termId,
                feeTypeId: dto.feeTypeId,
            });

            if (existing) {
                skipped.push(enrolment.studentId);
                continue;
            }

            const invoice = await this.feeRepository.createInvoice({
                studentId:   enrolment.studentId,
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