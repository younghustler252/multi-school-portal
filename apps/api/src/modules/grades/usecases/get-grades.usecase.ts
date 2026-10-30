import { IGradeRepository }  from "../repositories/grade.repository";
import { GradeResponseData } from "../mappers/grade.mapper";
import { PaginatedResult }   from "../../../infrastructure/repository/base.repository";
import { ListGradesDtoType } from "../dtos/grade.dto";
import { parsePagination, buildPaginationMeta } from "../../../shared/utils/pagination";

interface Dependencies {
    gradeRepository: IGradeRepository;
}

export class GetGradesUseCase {
    private readonly gradeRepository: IGradeRepository;

    constructor({ gradeRepository }: Dependencies) {
        this.gradeRepository = gradeRepository;
    }

    async execute(
        dto: ListGradesDtoType,
    ): Promise<PaginatedResult<GradeResponseData>> {
        const where: Record<string, any> = {};

        if (dto.studentId)      where.studentId      = dto.studentId;
        if (dto.termId)         where.termId          = dto.termId;
        if (dto.classSubjectId) where.classSubjectId  = dto.classSubjectId;
        if (dto.isPublished !== undefined) {
            where.isPublished = dto.isPublished === "true";
        }

        const { page, limit, skip } = parsePagination({
            page:  Number(dto.page)  || 1,
            limit: Number(dto.limit) || 50,
        });

        const [data, total] = await Promise.all([
            this.gradeRepository.findManyWithStudentName(where, skip, limit),
            this.gradeRepository.countGrades(where),
        ]);

        return {
            data,
            meta: buildPaginationMeta(total, page, limit),
        };
    }
}