import { IGradeRepository }  from "../repositories/grade.repository";
import { GradeMapper }       from "../mappers/grade.mapper";
import { GradeResponseData } from "../mappers/grade.mapper";
import { PaginatedResult }   from "../../../infrastructure/repository/base.repository";
import { ListGradesDtoType } from "../dtos/grade.dto";

/*
|--------------------------------------------------------------------------
| GET GRADES USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    gradeRepository: IGradeRepository;
    gradeMapper:     GradeMapper;
}

export class GetGradesUseCase {
    private readonly gradeRepository: IGradeRepository;
    private readonly gradeMapper:     GradeMapper;

    constructor({ gradeRepository, gradeMapper }: Dependencies) {
        this.gradeRepository = gradeRepository;
        this.gradeMapper     = gradeMapper;
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

        const result = await this.gradeRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 50,
            where,
            orderBy: { total: "desc" },
        });

        return {
            data: result.data.map(g => this.gradeMapper.toResponse(g)),
            meta: result.meta,
        };
    }
}