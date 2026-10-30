import { IGuardianRepository } from "../../guardians/repositories/guardian.repository";
import { IGradeRepository }    from "../repositories/grade.repository";
import { GradeMapper }         from "../mappers/grade.mapper";
import { GradeResponseData }   from "../mappers/grade.mapper";
import { PaginatedResult }     from "../../../infrastructure/repository/base.repository";
import { ForbiddenError }      from "../../../shared/errors/domain.errors";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    gradeRepository:    IGradeRepository;
    gradeMapper:        GradeMapper;
}

interface MyChildGradesParams {
    studentId?: string;
    termId?:    string;
    page?:      number;
    limit?:     number;
}

export class GetMyChildrenGradesUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly gradeRepository:    IGradeRepository;
    private readonly gradeMapper:        GradeMapper;

    constructor({ guardianRepository, gradeRepository, gradeMapper }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.gradeRepository    = gradeRepository;
        this.gradeMapper        = gradeMapper;
    }

    async execute(
        userId: string,
        params: MyChildGradesParams,
    ): Promise<PaginatedResult<GradeResponseData>> {
        const childIds = await this.guardianRepository.getChildStudentIds(userId);

        if (params.studentId && !childIds.includes(params.studentId)) {
            throw new ForbiddenError("This student is not linked to your account.");
        }

        const where: Record<string, any> = {
            studentId: params.studentId ?? { in: childIds },
        };
        if (params.termId) where.termId = params.termId;

        const result = await this.gradeRepository.paginate({
            page:    params.page  ?? 1,
            limit:   params.limit ?? 50,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(g => this.gradeMapper.toResponse(g)),
            meta: result.meta,
        };
    }
}