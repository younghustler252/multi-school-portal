import { IFeeRepository } from "../repositories/fee.repository";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { ListInvoicesDtoType } from "../dtos/fee.dto";
import {
    parsePagination,
    buildPaginationMeta,
} from "../../../shared/utils/pagination";

interface Dependencies {
    feeRepository: IFeeRepository;
    enrolmentRepository: IEnrolmentRepository;
}

export class GetInvoicesUseCase {
    private readonly feeRepository: IFeeRepository;
    private readonly enrolmentRepository: IEnrolmentRepository;

    constructor({
        feeRepository,
        enrolmentRepository,
    }: Dependencies) {
        this.feeRepository = feeRepository;
        this.enrolmentRepository = enrolmentRepository;
    }

    async execute(dto: ListInvoicesDtoType) {
        const where: Record<string, any> = {};

        if (dto.studentId) {
            where.studentId = dto.studentId;
        }

        if (dto.termId) {
            where.termId = dto.termId;
        }

        if (dto.status) {
            where.status = dto.status;
        }

        // Filter invoices by class.
        // A class filter requires a term so we can identify
        // the students enrolled in that class for that term.
        if (dto.classId && dto.termId) {
            const enrolments =
                await this.enrolmentRepository.findByClass(
                    dto.classId,
                    dto.termId,
                );

            const studentIds = enrolments.map(
                (enrolment) => enrolment.studentId,
            );

            where.studentId = {
                in:
                    studentIds.length > 0
                        ? studentIds
                        : ["__none__"],
            };
        }

        const {
            page,
            limit,
            skip,
        } = parsePagination({
            page: Number(dto.page) || 1,
            limit: Number(dto.limit) || 20,
        });

        const { data, total } =
            await this.feeRepository.paginateInvoicesEnriched(
                where,
                skip,
                limit,
            );

        return {
            data,
            meta: buildPaginationMeta(
                total,
                page,
                limit,
            ),
        };
    }
}