import { IGradeRepository }       from "../repositories/grade.repository";
import { GradeMapper }            from "../mappers/grade.mapper";
import { GradeResponseData }      from "../mappers/grade.mapper";
import { BulkEnterGradesDtoType } from "../dtos/grade.dto";

/*
|--------------------------------------------------------------------------
| BULK ENTER GRADES USE CASE
| Teacher enters grades for all students in a subject at once
|--------------------------------------------------------------------------
*/

interface Dependencies {
    gradeRepository: IGradeRepository;
    gradeMapper:     GradeMapper;
}

export class BulkEnterGradesUseCase {
    private readonly gradeRepository: IGradeRepository;
    private readonly gradeMapper:     GradeMapper;

    constructor({ gradeRepository, gradeMapper }: Dependencies) {
        this.gradeRepository = gradeRepository;
        this.gradeMapper     = gradeMapper;
    }

    async execute(dto: BulkEnterGradesDtoType): Promise<{
        entered:  GradeResponseData[];
        skipped:  string[];
    }> {
        const configs  = await this.gradeRepository.findGradingConfigs();
        const entered:  GradeResponseData[] = [];
        const skipped:  string[]            = [];

        for (const record of dto.grades) {
            // Skip if already exists
            const existing = await this.gradeRepository
                .findByStudentTermSubject(
                    record.studentId,
                    dto.termId,
                    dto.classSubjectId,
                );

            if (existing) {
                skipped.push(record.studentId);
                continue;
            }

            const caScore   = record.caScore   ?? 0;
            const examScore = record.examScore  ?? 0;
            const total     = caScore + examScore;

            const config = configs.find(
                c => total >= c.minScore && total <= c.maxScore,
            );

            const grade = await this.gradeRepository.create({
                studentId:      record.studentId,
                termId:         dto.termId,
                classSubjectId: dto.classSubjectId,
                caScore:        record.caScore,
                examScore:      record.examScore,
                total,
                grade:          config?.grade  ?? "F9",
                remark:         config?.remark ?? "Fail",
                isPublished:    false,
            });

            entered.push(this.gradeMapper.toResponse(grade));
        }

        // ── Calculate positions ───────────────────────────────────────────
        await this.calculatePositions(dto.termId, dto.classSubjectId);

        return { entered, skipped };
    }

    private async calculatePositions(
        termId:         string,
        classSubjectId: string,
    ): Promise<void> {
        const grades = await this.gradeRepository.findByTermAndSubject(
            termId,
            classSubjectId,
        );

        // Sort by total descending
        const sorted = [...grades].sort(
            (a, b) => (b.total ?? 0) - (a.total ?? 0),
        );

        const totalStudents = sorted.length;

        // Update positions
        for (let i = 0; i < sorted.length; i++) {
            await this.gradeRepository.update(sorted[i].id, {
                position:     i + 1,
                totalStudents,
            });
        }
    }
}