import { IGradeRepository }    from "../repositories/grade.repository";
import { PublishGradesDtoType } from "../dtos/grade.dto";

/*
|--------------------------------------------------------------------------
| PUBLISH GRADES USE CASE
| School admin publishes grades — makes them visible to students/parents
|--------------------------------------------------------------------------
*/

interface Dependencies {
    gradeRepository: IGradeRepository;
}

export class PublishGradesUseCase {
    private readonly gradeRepository: IGradeRepository;

    constructor({ gradeRepository }: Dependencies) {
        this.gradeRepository = gradeRepository;
    }

    async execute(
        dto: PublishGradesDtoType,
    ): Promise<{ published: number }> {
        const count = await this.gradeRepository.publishGrades(
            dto.termId,
            dto.classSubjectId,
        );

        return { published: count };
    }
}