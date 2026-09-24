import { IFeeRepository }       from "../repositories/fee.repository";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { NotFoundError, ConflictError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    feeRepository:       IFeeRepository;
    enrolmentRepository: IEnrolmentRepository;
}

export class InvoiceStudentLikeClassUseCase {
    constructor(private readonly deps: Dependencies) {}

    async execute(studentId: string, classId: string, termId: string) {
        const existing = await this.deps.feeRepository.findInvoiceByStudentAndTerm(studentId, termId);
        if (existing) throw new ConflictError("An invoice already exists for this student this term.");

        // Find any existing invoice already issued to this class for this term, use it as the template
        const classmates = await this.deps.enrolmentRepository.findByClass(classId, termId);
        let templateItems: Array<{ feeTypeId: string; amountKobo: number }> | null = null;

        for (const mate of classmates) {
            if (mate.studentId === studentId) continue;
            const invoice = await this.deps.feeRepository.findInvoiceByStudentAndTerm(mate.studentId, termId);
            if (invoice) {
                templateItems = invoice.items.map(i => ({ feeTypeId: i.feeTypeId, amountKobo: i.amountKobo }));
                break;
            }
        }

        if (!templateItems) throw new NotFoundError("No existing invoice found for this class to copy from.");

        return this.deps.feeRepository.createInvoice(studentId, termId, templateItems);
    }
}