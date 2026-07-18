import { IReportCardRepository }  from "../repositories/report-card.repository";
import { IGradeRepository }       from "../../grades/repositories/grade.repository";
import { IStudentRepository }     from "../../students/repositories/student.repository";
import { ReportCardMapper }       from "../mappers/report-card.mapper";
import { NotFoundError }          from "../../../shared/errors/domain.errors";
import { ReportCardErrorMessage } from "../domain/report-card.enums";

interface Dependencies {
    reportCardRepository: IReportCardRepository;
    gradeRepository:      IGradeRepository;
    studentRepository:    IStudentRepository;
    reportCardMapper:     ReportCardMapper;
}

export interface FullReportCard {
    reportCard: any;
    student:    any;
    grades:     any[];
}

export class GetReportCardUseCase {
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

    async execute(id: string): Promise<FullReportCard> {
        const reportCard = await this.reportCardRepository.findById(id);
        if (!reportCard) throw new NotFoundError(ReportCardErrorMessage.NOT_FOUND);

        const [student, grades] = await Promise.all([
            this.studentRepository.findById(reportCard.studentId),
            this.gradeRepository.findByStudentAndTerm(
                reportCard.studentId,
                reportCard.termId,
            ),
        ]);

        return {
            reportCard: this.reportCardMapper.toResponse(reportCard),
            student,
            grades:     grades.filter(g => g.isPublished),
        };
    }
}