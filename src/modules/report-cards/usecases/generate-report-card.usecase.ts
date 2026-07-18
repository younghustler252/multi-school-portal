import { IReportCardRepository }   from "../repositories/report-card.repository";
import { IGradeRepository }        from "../../grades/repositories/grade.repository";
import { IStudentRepository }      from "../../students/repositories/student.repository";
import { ReportCardMapper }        from "../mappers/report-card.mapper";
import { ReportCardResponseData }  from "../mappers/report-card.mapper";
import {
    NotFoundError,
    ConflictError,
    BadRequestError,
}                                  from "../../../shared/errors/domain.errors";
import { ReportCardErrorMessage }  from "../domain/report-card.enums";
import { GenerateReportCardDtoType } from "../dtos/report-card.dto";

/*
|--------------------------------------------------------------------------
| GENERATE REPORT CARD USE CASE
| Flow:
| 1. Check student exists
| 2. Check report card not already generated
| 3. Fetch all published grades for student + term
| 4. Calculate totals, average, position
| 5. Create report card record
|--------------------------------------------------------------------------
*/

interface Dependencies {
    reportCardRepository: IReportCardRepository;
    gradeRepository:      IGradeRepository;
    studentRepository:    IStudentRepository;
    reportCardMapper:     ReportCardMapper;
}

export class GenerateReportCardUseCase {
    private readonly reportCardRepository: IReportCardRepository;
    private readonly gradeRepository:      IGradeRepository;
    private readonly studentRepository:    IStudentRepository;
    private readonly reportCardMapper:     ReportCardMapper;

    constructor({
        reportCardRepository,
        gradeRepository,
        studentRepository,
        reportCardMapper,
    }: Dependencies) {
        this.reportCardRepository = reportCardRepository;
        this.gradeRepository      = gradeRepository;
        this.studentRepository    = studentRepository;
        this.reportCardMapper     = reportCardMapper;
    }

    async execute(
        dto: GenerateReportCardDtoType,
    ): Promise<ReportCardResponseData> {

        // ── 1. Check student exists ───────────────────────────────────────
        const student = await this.studentRepository.findById(dto.studentId);
        if (!student) throw new NotFoundError("Student");

        // ── 2. Check not already generated ───────────────────────────────
        const existing = await this.reportCardRepository
            .findByStudentAndTerm(dto.studentId, dto.termId);

        if (existing) {
            throw new ConflictError(ReportCardErrorMessage.ALREADY_EXISTS);
        }

        // ── 3. Fetch published grades ─────────────────────────────────────
        const grades = await this.gradeRepository
            .findByStudentAndTerm(dto.studentId, dto.termId);

        const publishedGrades = grades.filter(g => g.isPublished);

        if (publishedGrades.length === 0) {
            throw new BadRequestError(ReportCardErrorMessage.GRADES_NOT_FOUND);
        }

        // ── 4. Calculate scores ───────────────────────────────────────────
        const totalScore   = publishedGrades.reduce(
            (sum, g) => sum + (g.total ?? 0), 0,
        );
        const averageScore = parseFloat(
            (totalScore / publishedGrades.length).toFixed(2),
        );

        // Position from grades (use first grade's position as class position)
        const position      = publishedGrades[0]?.position      ?? null;
        const totalStudents = publishedGrades[0]?.totalStudents ?? null;

        // ── 5. Create report card ─────────────────────────────────────────
        const reportCard = await this.reportCardRepository.create({
            studentId:       dto.studentId,
            termId:          dto.termId,
            status:          "generated",
            teacherRemark:   dto.teacherRemark,
            principalRemark: dto.principalRemark,
            totalScore,
            averageScore,
            position,
            totalStudents,
            generatedAt:     new Date(),
        });

        return this.reportCardMapper.toResponse(reportCard);
    }
}