import { IGradeRepository }   from "../repositories/grade.repository";
import { GradeMapper }        from "../mappers/grade.mapper";
import { GradeResponseData }  from "../mappers/grade.mapper";
import { ConflictError }      from "../../../shared/errors/domain.errors";
import { GradeErrorMessage }  from "../domain/grade.enums";
import { EnterGradeDtoType }  from "../dtos/grade.dto";

/*
|--------------------------------------------------------------------------
| ENTER GRADE USE CASE
| Teacher enters CA and/or exam score for a student
| Auto-calculates total and grade from grading config
|--------------------------------------------------------------------------
*/

interface Dependencies {
    gradeRepository: IGradeRepository;
    gradeMapper:     GradeMapper;
}

export class EnterGradeUseCase {
    private readonly gradeRepository: IGradeRepository;
    private readonly gradeMapper:     GradeMapper;

    constructor({ gradeRepository, gradeMapper }: Dependencies) {
        this.gradeRepository = gradeRepository;
        this.gradeMapper     = gradeMapper;
    }

    async execute(dto: EnterGradeDtoType): Promise<GradeResponseData> {

        // ── Check not already entered ─────────────────────────────────────
        const existing = await this.gradeRepository
            .findByStudentTermSubject(
                dto.studentId,
                dto.termId,
                dto.classSubjectId,
            );

        if (existing) {
            throw new ConflictError(GradeErrorMessage.ALREADY_EXISTS);
        }

        // ── Calculate total ───────────────────────────────────────────────
        const caScore    = dto.caScore    ?? 0;
        const examScore  = dto.examScore  ?? 0;
        const total      = caScore + examScore;

        // ── Get grade from grading config ─────────────────────────────────
        const { grade, remark } = await this.calculateGrade(total);

        // ── Create grade record ───────────────────────────────────────────
        const gradeRecord = await this.gradeRepository.create({
            studentId:      dto.studentId,
            termId:         dto.termId,
            classSubjectId: dto.classSubjectId,
            caScore:        dto.caScore,
            examScore:      dto.examScore,
            total,
            grade,
            remark,
            isPublished:    false,
        });

        return this.gradeMapper.toResponse(gradeRecord);
    }

    private async calculateGrade(
        total: number,
    ): Promise<{ grade: string; remark: string }> {
        const configs = await this.gradeRepository.findGradingConfigs();

        const config = configs.find(
            c => total >= c.minScore && total <= c.maxScore,
        );

        return {
            grade:  config?.grade  ?? "F9",
            remark: config?.remark ?? "Fail",
        };
    }
}