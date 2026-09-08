import { IFeeRepository }       from "../repositories/fee.repository";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { InvoiceClassDtoType }  from "../dtos/fee.dto";

interface Dependencies {
    feeRepository:       IFeeRepository;
    enrolmentRepository: IEnrolmentRepository;
}

export class InvoiceClassUseCase {
    private readonly feeRepository:       IFeeRepository;
    private readonly enrolmentRepository: IEnrolmentRepository;

    constructor({ feeRepository, enrolmentRepository }: Dependencies) {
        this.feeRepository       = feeRepository;
        this.enrolmentRepository = enrolmentRepository;
    }

    async execute(dto: InvoiceClassDtoType) {
        const enrolments = await this.enrolmentRepository.findMany({
            classId: dto.classId,
            termId:  dto.termId,
            status:  "active",
        });

        const created: any[]    = [];
        const skipped: string[] = [];

        for (const enrolment of enrolments) {
            const existing = await this.feeRepository.findInvoiceByStudentAndTerm(
                enrolment.studentId,
                dto.termId,
            );

            if (existing) {
                skipped.push(enrolment.studentId);
                continue;
            }

            const invoice = await this.feeRepository.createInvoice(
                enrolment.studentId,
                dto.termId,
                dto.items,
                dto.dueDate ? new Date(dto.dueDate) : undefined,
            );

            created.push(invoice);
        }

        return { created, skipped };
    }
}