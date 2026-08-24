import { IReportCardRepository }   from "../repositories/report-card.repository";
import { IGradeRepository }        from "../../grades/repositories/grade.repository";
import { IStudentRepository }      from "../../students/repositories/student.repository";
import { IEnrolmentRepository }    from "../../enrolment/repositories/enrolment.repository";
import { IClassRepository }        from "../../classes/repositories/class.repository";
import { ISessionRepository }      from "../../sessions/repositories/session.repository";
import { ISchoolSettingsRepository } from "../../school-settings/repositories/school-settings.repository";
import { ISchoolRepository }       from "../../school/repositories/school.repository";
import { SupabaseStorageService }  from "../../../infrastructure/storage/supabase-storage.service";
import { PdfGeneratorService }     from "../../../infrastructure/pdf/pdf-generator.service";
import { ReportCardMapper }        from "../mappers/report-card.mapper";
import { ReportCardResponseData }  from "../mappers/report-card.mapper";
import {
    NotFoundError,
    ConflictError,
    BadRequestError,
}                                  from "../../../shared/errors/domain.errors";
import { ReportCardErrorMessage }  from "../domain/report-card.enums";
import { GenerateReportCardDtoType } from "../dtos/report-card.dto";

interface Dependencies {
    reportCardRepository:      IReportCardRepository;
    gradeRepository:           IGradeRepository;
    studentRepository:         IStudentRepository;
    enrolmentRepository:       IEnrolmentRepository;
    classRepository:           IClassRepository;
    sessionRepository:         ISessionRepository;
    schoolSettingsRepository:  ISchoolSettingsRepository;
    schoolRepository:          ISchoolRepository;
    storageService:            SupabaseStorageService;
    pdfGeneratorService:       PdfGeneratorService;
    reportCardMapper:          ReportCardMapper;
}

export class GenerateReportCardUseCase {
    private readonly reportCardRepository:     IReportCardRepository;
    private readonly gradeRepository:          IGradeRepository;
    private readonly studentRepository:        IStudentRepository;
    private readonly enrolmentRepository:      IEnrolmentRepository;
    private readonly classRepository:          IClassRepository;
    private readonly sessionRepository:        ISessionRepository;
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;
    private readonly schoolRepository:         ISchoolRepository;
    private readonly storageService:           SupabaseStorageService;
    private readonly pdfGeneratorService:      PdfGeneratorService;
    private readonly reportCardMapper:         ReportCardMapper;

    constructor(deps: Dependencies) {
        this.reportCardRepository     = deps.reportCardRepository;
        this.gradeRepository          = deps.gradeRepository;
        this.studentRepository        = deps.studentRepository;
        this.enrolmentRepository      = deps.enrolmentRepository;
        this.classRepository          = deps.classRepository;
        this.sessionRepository        = deps.sessionRepository;
        this.schoolSettingsRepository = deps.schoolSettingsRepository;
        this.schoolRepository         = deps.schoolRepository;
        this.storageService           = deps.storageService;
        this.pdfGeneratorService      = deps.pdfGeneratorService;
        this.reportCardMapper         = deps.reportCardMapper;
    }

    async execute(
        dto:      GenerateReportCardDtoType,
        schoolId: string,
    ): Promise<ReportCardResponseData> {

        const student = await this.studentRepository.findById(dto.studentId);
        if (!student) throw new NotFoundError("Student");

        const existing = await this.reportCardRepository
            .findByStudentAndTerm(dto.studentId, dto.termId);
        if (existing) {
            throw new ConflictError(ReportCardErrorMessage.ALREADY_EXISTS);
        }

        const grades = await this.gradeRepository.findByStudentAndTerm(dto.studentId, dto.termId);
        const publishedGrades = grades.filter(g => g.isPublished);

        if (publishedGrades.length === 0) {
            throw new BadRequestError(ReportCardErrorMessage.GRADES_NOT_FOUND);
        }

        const totalScore   = publishedGrades.reduce((sum, g) => sum + (g.total ?? 0), 0);
        const averageScore = parseFloat((totalScore / publishedGrades.length).toFixed(2));
        const position      = publishedGrades[0]?.position      ?? null;
        const totalStudents = publishedGrades[0]?.totalStudents ?? null;

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

        // ── Gather everything the PDF needs ─────────────────────────────
        const [school, settings, term, enrolment, subjectNames] = await Promise.all([
            this.schoolRepository.findById(schoolId),
            this.schoolSettingsRepository.find(),
            this.sessionRepository.findTermById(dto.termId),
            this.enrolmentRepository.findByStudentAndTerm(dto.studentId, dto.termId),
            this.classRepository.findSubjectNamesByClassSubjectIds(
                publishedGrades.map(g => g.classSubjectId),
            ),
        ]);

        const cls = enrolment
            ? await this.classRepository.findClassById(enrolment.classId)
            : null;

        const session = term
            ? await this.sessionRepository.findSessionById(term.sessionId)
            : null;

        const pdfBuffer = await this.pdfGeneratorService.generateReportCardPdf(
            settings?.reportCardTemplate ?? "classic",
            {
                school: {
                    name:    school?.name ?? "School",
                    logoUrl: school?.logoUrl ?? null,
                    motto:   settings?.motto ?? null,
                    address: settings?.address ?? null,
                },
                student: {
                    firstName:       student.firstName,
                    lastName:        student.lastName,
                    admissionNumber: student.admissionNumber,
                    photoUrl:        student.photoUrl,
                    gender:          student.gender,
                },
                className:   cls?.name ?? "-",
                sessionName: session?.name ?? "-",
                termName:    term?.name ?? "-",
                subjects: publishedGrades.map(g => ({
                    subjectName: subjectNames.get(g.classSubjectId) ?? "Unknown",
                    caScore:     g.caScore,
                    examScore:   g.examScore,
                    total:       g.total,
                    grade:       g.grade,
                    remark:      g.remark,
                })),
                totalScore,
                averageScore,
                position,
                totalStudents,
                teacherRemark:   dto.teacherRemark   ?? null,
                principalRemark: dto.principalRemark ?? null,
                branding: {
                    primaryColor:   settings?.primaryColor   ?? "#1a1a2e",
                    secondaryColor: settings?.secondaryColor ?? null,
                    stampUrl:       settings?.stamp          ?? null,
                    signatureUrl:   settings?.signature      ?? null,
                },
                letterhead: settings?.reportCardTemplate === "custom_letterhead" && settings.reportCardLetterheadUrl
                    ? {
                        imageUrl:        settings.reportCardLetterheadUrl,
                        contentTopMm:    settings.letterheadContentTopMm    ?? 50,
                        contentBottomMm: settings.letterheadContentBottomMm ?? 30,
                    }
                    : undefined,
                    },
        );

        // ── Upload (private bucket — same reasoning as verification docs) ──
        const uploadResult = await this.storageService.upload({
            folder:   `schools/${schoolId}/report-cards/${dto.termId}`,
            file:     pdfBuffer,
            mimetype: "application/pdf",
            filename: `${student.firstName}-${student.lastName}-report-card.pdf`,
        });

        const updated = await this.reportCardRepository.update(reportCard.id, {
            pdfUrl: uploadResult.path,
        });

        return this.reportCardMapper.toResponse(updated);
    }
}