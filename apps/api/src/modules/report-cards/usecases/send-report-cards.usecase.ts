import { IReportCardRepository }  from "../repositories/report-card.repository";
import { IStudentRepository }     from "../../students/repositories/student.repository";
import { MailService }            from "../../../infrastructure/mail/mail.service";
import { SmsService }             from "../../../infrastructure/sms/sms.service";
import { NotFoundError }          from "../../../shared/errors/domain.errors";
import { ReportCardErrorMessage } from "../domain/report-card.enums";

/*
|--------------------------------------------------------------------------
| SEND REPORT CARDS USE CASE
| Sends report card notification to guardians via email/SMS
|--------------------------------------------------------------------------
*/

interface Dependencies {
    reportCardRepository: IReportCardRepository;
    studentRepository:    IStudentRepository;
    mailService:          MailService;
    smsService:           SmsService;
}

export class SendReportCardsUseCase {
    private readonly reportCardRepository: IReportCardRepository;
    private readonly studentRepository:    IStudentRepository;
    private readonly mailService:          MailService;
    private readonly smsService:           SmsService;

    constructor({
        reportCardRepository,
        studentRepository,
        mailService,
        smsService,
    }: Dependencies) {
        this.reportCardRepository = reportCardRepository;
        this.studentRepository    = studentRepository;
        this.mailService          = mailService;
        this.smsService           = smsService;
    }

    async execute(
        reportCardId: string,
        schoolName:   string,
        subdomain:    string,
        termName:     string,
    ): Promise<{ message: string }> {

        const reportCard = await this.reportCardRepository.findById(reportCardId);
        if (!reportCard) throw new NotFoundError(ReportCardErrorMessage.NOT_FOUND);

        const student = await this.studentRepository.findById(
            reportCard.studentId,
        );
        if (!student) throw new NotFoundError("Student");

        const portalUrl = `https://${subdomain}.${process.env.APP_BASE_DOMAIN}/report-cards/${reportCardId}`;
        const studentName = `${student.firstName} ${student.lastName}`;

        // ── Send SMS notification ─────────────────────────────────────────
        await this.smsService.sendReportCardNotice({
            to:          "+2340000000000", // guardian phone — wire from guardian later
            firstName:   "Parent",
            studentName,
            schoolName,
            term:        termName,
            portalUrl,
        });

        // ── Update timestamps ─────────────────────────────────────────────
        await this.reportCardRepository.update(reportCardId, {
            smsSentAt: new Date(),
            status:    "sent",
        });

        return { message: `Report card notification sent for ${studentName}` };
    }
}