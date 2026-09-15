import { IFeeRepository } from "../repositories/fee.repository";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { InvoiceClassDtoType } from "../dtos/fee.dto";

interface Dependencies {
	feeRepository: IFeeRepository;
	enrolmentRepository: IEnrolmentRepository;
}

export class InvoiceClassUseCase {
	private readonly feeRepository: IFeeRepository;
	private readonly enrolmentRepository: IEnrolmentRepository;

	constructor({
		feeRepository,
		enrolmentRepository,
	}: Dependencies) {
		this.feeRepository = feeRepository;
		this.enrolmentRepository = enrolmentRepository;
	}

	async execute(dto: InvoiceClassDtoType) {
		const studentIds = new Set<string>();

		// Find all active enrolments across every selected class.
		for (const classId of dto.classIds) {
			const enrolments = await this.enrolmentRepository.findMany({
				classId,
				termId: dto.termId,
				status: "active",
			});

			for (const enrolment of enrolments) {
				studentIds.add(enrolment.studentId);
			}
		}

		const created: any[] = [];
		const skipped: string[] = [];

		// Create one invoice per student for the selected term.
		for (const studentId of studentIds) {
			const existing =
				await this.feeRepository.findInvoiceByStudentAndTerm(
					studentId,
					dto.termId,
				);

			if (existing) {
				skipped.push(studentId);
				continue;
			}

			const invoice = await this.feeRepository.createInvoice(
				studentId,
				dto.termId,
				dto.items,
				dto.dueDate
					? new Date(dto.dueDate)
					: undefined,
			);

			created.push(invoice);
		}

		return {
			created,
			skipped,
		};
	}
}
