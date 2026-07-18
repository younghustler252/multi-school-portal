import { IReportCardRepository }      from "../repositories/report-card.repository";
import { IGradeRepository }           from "../../grades/repositories/grade.repository";
import { IEnrolmentRepository }       from "../../enrolment/repositories/enrolment.repository";
import { ReportCardMapper }           from "../mappers/report-card.mapper";
import { ReportCardResponseData }     from "../mappers/report-card.mapper";
import { BulkGenerateReportCardDtoType } from "../dtos/report-card.dto";

/*
|--------------------------------------------------------------------------
| BULK GENERATE REPORT CARDS USE CASE
| Generates report cards for all enrolled students in a term
|--------------------------------------------------------------------------
*/

interface Dependencies {
    reportCardRepository: IReportCardRepository;
    gradeRepository:      IGradeRepository;
    enrolmentRepository:  IEnrolmentRepository;
    reportCardMapper:     ReportCardMapper;
}

export class BulkGenerateReportCardsUseCase {
    private readonly reportCardRepository: IReportCardRepository;
    private readonly gradeRepository:      IGradeRepository;
    private readonly enrolmentRepository:  IEnrolmentRepository;
    private readonly reportCardMapper:     ReportCardMapper;

    constructor({
        reportCardRepository,
        gradeRepository,
        enrolmentRepository,
        reportCardMapper,
    }: Dependencies) {
        this.reportCardRepository = reportCardRepository;
        this.gradeRepository      = gradeRepository;
        this.enrolmentRepository  = enrolmentRepository;
        this.reportCardMapper     = reportCardMapper;
    }

    async execute(dto: BulkGenerateReportCardDtoType): Promise<{
        generated: ReportCardResponseData[];
        skipped:   string[];
    }> {
        // ── Get all enrolments for this term ──────────────────────────────
        const where: Record<string, any> = {
            termId: dto.termId,
            status: "active",
        };
        if (dto.classId) where.classId = dto.classId;

        const enrolments = await this.enrolmentRepository.findMany(where);

        const generated: ReportCardResponseData[] = [];
        const skipped:   string[]                 = [];

        for (const enrolment of enrolments) {
            // Skip if already generated
            const existing = await this.reportCardRepository
                .findByStudentAndTerm(enrolment.studentId, dto.termId);

            if (existing) {
                skipped.push(enrolment.studentId);
                continue;
            }

            // Get published grades
            const grades = await this.gradeRepository
                .findByStudentAndTerm(enrolment.studentId, dto.termId);

            const publishedGrades = grades.filter(g => g.isPublished);
            if (publishedGrades.length === 0) {
                skipped.push(enrolment.studentId);
                continue;
            }

            const totalScore   = publishedGrades.reduce(
                (sum, g) => sum + (g.total ?? 0), 0,
            );
            const averageScore = parseFloat(
                (totalScore / publishedGrades.length).toFixed(2),
            );

            const reportCard = await this.reportCardRepository.create({
                studentId:       enrolment.studentId,
                termId:          dto.termId,
                status:          "generated",
                principalRemark: dto.principalRemark,
                totalScore,
                averageScore,
                position:        publishedGrades[0]?.position     ?? null,
                totalStudents:   publishedGrades[0]?.totalStudents ?? null,
                generatedAt:     new Date(),
            });

            generated.push(this.reportCardMapper.toResponse(reportCard));
        }

        return { generated, skipped };
    }
}