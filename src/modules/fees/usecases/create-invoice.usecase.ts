import { IFeeRepository }        from "../repositories/fee.repository";
import { IStudentRepository }    from "../../students/repositories/student.repository";
import { FeeInvoiceMapper }      from "../mappers/fee.mapper";
import { FeeInvoiceResponseData } from "../mappers/fee.mapper";
import {
    NotFoundError,
    ConflictError,
}                                from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }       from "../domain/fee.enums";
import { CreateInvoiceDtoType }  from "../dtos/fee.dto";

interface Dependencies {
    feeRepository:     IFeeRepository;
    studentRepository: IStudentRepository;
    feeInvoiceMapper:  FeeInvoiceMapper;
}

export class CreateInvoiceUseCase {
    private readonly feeRepository:     IFeeRepository;
    private readonly studentRepository: IStudentRepository;
    private readonly feeInvoiceMapper:  FeeInvoiceMapper;

    constructor({
        feeRepository,
        studentRepository,
        feeInvoiceMapper,
    }: Dependencies) {
        this.feeRepository     = feeRepository;
        this.studentRepository = studentRepository;
        this.feeInvoiceMapper  = feeInvoiceMapper;
    }

    async execute(
        dto: CreateInvoiceDtoType,
    ): Promise<FeeInvoiceResponseData> {

        // ── Check student exists ──────────────────────────────────────────
        const student = await this.studentRepository.findById(dto.studentId);
        if (!student) throw new NotFoundError(FeeErrorMessage.STUDENT_NOT_FOUND);

        // ── Check fee type exists ─────────────────────────────────────────
        const feeType = await this.feeRepository.findFeeTypeById(dto.feeTypeId);
        if (!feeType) throw new NotFoundError(FeeErrorMessage.FEE_TYPE_NOT_FOUND);

        // ── Check not already invoiced ────────────────────────────────────
        const existing = await this.feeRepository.findInvoice({
            studentId: dto.studentId,
            termId:    dto.termId,
            feeTypeId: dto.feeTypeId,
        });
        if (existing) throw new ConflictError(FeeErrorMessage.ALREADY_INVOICED);

        // ── Create invoice ────────────────────────────────────────────────
        const invoice = await this.feeRepository.createInvoice({
            studentId:   dto.studentId,
            termId:      dto.termId,
            feeTypeId:   dto.feeTypeId,
            amountKobo:  dto.amountKobo,
            paidKobo:    0,
            balanceKobo: dto.amountKobo,
            status:      "unpaid",
            dueDate:     dto.dueDate ? new Date(dto.dueDate) : null,
            note:        dto.note,
        });

        return this.feeInvoiceMapper.toResponse(invoice);
    }
}