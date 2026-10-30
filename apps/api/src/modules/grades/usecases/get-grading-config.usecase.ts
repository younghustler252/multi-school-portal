import { IGradeRepository }           from "../repositories/grade.repository";
import { GradingConfigMapper }        from "../mappers/grade.mapper";
import { GradingConfigResponseData }  from "../mappers/grade.mapper";

/*
|--------------------------------------------------------------------------
| GET GRADING CONFIG USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    gradeRepository:     IGradeRepository;
    gradingConfigMapper: GradingConfigMapper;
}

export class GetGradingConfigUseCase {
    private readonly gradeRepository:     IGradeRepository;
    private readonly gradingConfigMapper: GradingConfigMapper;

    constructor({ gradeRepository, gradingConfigMapper }: Dependencies) {
        this.gradeRepository     = gradeRepository;
        this.gradingConfigMapper = gradingConfigMapper;
    }

    async execute(): Promise<GradingConfigResponseData[]> {
        const configs = await this.gradeRepository.findGradingConfigs();
        return configs.map(c => this.gradingConfigMapper.toResponse(c));
    }
}