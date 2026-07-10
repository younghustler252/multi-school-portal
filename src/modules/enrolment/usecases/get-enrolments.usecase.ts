import { IEnrolmentRepository }  from "../repositories/enrolment.repository";
import { EnrolmentMapper }       from "../mappers/enrolment.mapper";
import { EnrolmentResponseData } from "../mappers/enrolment.mapper";
import { PaginatedResult }       from "../../../infrastructure/repository/base.repository";
import { ListEnrolmentsDtoType } from "../dtos/enrolment.dto";

/*
|--------------------------------------------------------------------------
| GET ENROLMENTS USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository;
    enrolmentMapper:     EnrolmentMapper;
}

export class GetEnrolmentsUseCase {
    private readonly enrolmentRepository: IEnrolmentRepository;
    private readonly enrolmentMapper:     EnrolmentMapper;

    constructor({ enrolmentRepository, enrolmentMapper }: Dependencies) {
        this.enrolmentRepository = enrolmentRepository;
        this.enrolmentMapper     = enrolmentMapper;
    }

    async execute(
        dto: ListEnrolmentsDtoType,
    ): Promise<PaginatedResult<EnrolmentResponseData>> {

        const where: Record<string, any> = {};

        if (dto.classId)   where.classId   = dto.classId;
        if (dto.termId)    where.termId     = dto.termId;
        if (dto.studentId) where.studentId  = dto.studentId;
        if (dto.status)    where.status     = dto.status;

        const result = await this.enrolmentRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(e =>
                this.enrolmentMapper.toResponse(e),
            ),
            meta: result.meta,
        };
    }
}