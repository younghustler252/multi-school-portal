import { IGradeRepository }  from "../repositories/grade.repository";
import { GradeMapper }       from "../mappers/grade.mapper";
import { GradeResponseData } from "../mappers/grade.mapper";
import { NotFoundError }     from "../../../shared/errors/domain.errors";
import { GradeErrorMessage } from "../domain/grade.enums";
import { UpdateGradeDtoType } from "../dtos/grade.dto";

/*
|--------------------------------------------------------------------------
| UPDATE GRADE USE CASE
| Teacher corrects a grade — recalculates total and grade
|--------------------------------------------------------------------------
*/

interface Dependencies {
    gradeRepository: IGradeRepository;
    gradeMapper:     GradeMapper;
}

export class UpdateGradeUseCase {
    private readonly gradeRepository: IGradeRepository;
    private readonly gradeMapper:     GradeMapper;

    constructor({ gradeRepository, gradeMapper }: Dependencies) {
        this.gradeRepository = gradeRepository;
        this.gradeMapper     = gradeMapper;
    }

    async execute(
        id:  string,
        dto: UpdateGradeDtoType,
    ): Promise<GradeResponseData> {

        const existing = await this.gradeRepository.findById(id);
        if (!existing) {
            throw new NotFoundError(GradeErrorMessage.NOT_FOUND);
        }

        // ── Recalculate total ─────────────────────────────────────────────
        const caScore   = dto.caScore   ?? existing.caScore   ?? 0;
        const examScore = dto.examScore ?? existing.examScore ?? 0;
        const total     = caScore + examScore;

        // ── Recalculate grade ─────────────────────────────────────────────
        const configs = await this.gradeRepository.findGradingConfigs();
        const config  = configs.find(
            c => total >= c.minScore && total <= c.maxScore,
        );

        const updated = await this.gradeRepository.update(id, {
            caScore:   dto.caScore,
            examScore: dto.examScore,
            total,
            grade:     config?.grade  ?? "F9",
            remark:    config?.remark ?? "Fail",
        });

        return this.gradeMapper.toResponse(updated);
    }
}