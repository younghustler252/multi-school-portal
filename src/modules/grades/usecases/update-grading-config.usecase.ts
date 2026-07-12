import { IGradeRepository }          from "../repositories/grade.repository";
import { GradingConfigMapper }       from "../mappers/grade.mapper";
import { GradingConfigResponseData } from "../mappers/grade.mapper";
import { UpdateGradingConfigDtoType } from "../dtos/grade.dto";

/*
|--------------------------------------------------------------------------
| UPDATE GRADING CONFIG USE CASE
| School admin replaces grading scale (Pro plan feature)
|--------------------------------------------------------------------------
*/

interface Dependencies {
    gradeRepository:     IGradeRepository;
    gradingConfigMapper: GradingConfigMapper;
}

export class UpdateGradingConfigUseCase {
    private readonly gradeRepository:     IGradeRepository;
    private readonly gradingConfigMapper: GradingConfigMapper;

    constructor({ gradeRepository, gradingConfigMapper }: Dependencies) {
        this.gradeRepository     = gradeRepository;
        this.gradingConfigMapper = gradingConfigMapper;
    }

    async execute(
        dto: UpdateGradingConfigDtoType,
    ): Promise<GradingConfigResponseData[]> {

        // ── Delete existing config ────────────────────────────────────────
        await this.gradeRepository.deleteAllGradingConfigs();

        // ── Create new config ─────────────────────────────────────────────
        const results: GradingConfigResponseData[] = [];

        for (const config of dto.configs) {
            const created = await this.gradeRepository.createGradingConfig({
                ...config,
                isDefault: false,
            });
            results.push(this.gradingConfigMapper.toResponse(created));
        }

        return results;
    }
}