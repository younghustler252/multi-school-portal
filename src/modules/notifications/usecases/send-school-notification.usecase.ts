import { INotificationRepository }        from "../repositories/notification.repository";
import { SchoolNotificationMapper }       from "../mappers/notification.mapper";
import { SchoolNotificationResponseData } from "../mappers/notification.mapper";
import { MailService }                    from "../../../infrastructure/mail/mail.service";
import { SmsService }                     from "../../../infrastructure/sms/sms.service";
import { SendSchoolNotificationDtoType }  from "../dtos/notification.dto";
import { addNotificationJob }             from "../../../infrastructure/jobs/queues/notification.queue";

/*
|--------------------------------------------------------------------------
| SEND SCHOOL NOTIFICATION USE CASE
| School admin broadcasts to students, guardians, or staff
| Supports: in-app, email, SMS channels
| Queues delivery via BullMQ for async processing
|--------------------------------------------------------------------------
*/

interface Dependencies {
    notificationRepository:  INotificationRepository;
    schoolNotificationMapper: SchoolNotificationMapper;
    mailService:             MailService;
    smsService:              SmsService;
}

export class SendSchoolNotificationUseCase {
    private readonly notificationRepository:  INotificationRepository;
    private readonly schoolNotificationMapper: SchoolNotificationMapper;
    private readonly mailService:             MailService;
    private readonly smsService:              SmsService;

    constructor({
        notificationRepository,
        schoolNotificationMapper,
        mailService,
        smsService,
    }: Dependencies) {
        this.notificationRepository  = notificationRepository;
        this.schoolNotificationMapper = schoolNotificationMapper;
        this.mailService             = mailService;
        this.smsService              = smsService;
    }

    async execute(
        dto:     SendSchoolNotificationDtoType,
        staffId: string,
    ): Promise<SchoolNotificationResponseData> {

        // ── Create notification record ─────────────────────────────────────
        const notification = await this.notificationRepository
            .createSchoolNotification({
                title:      dto.title,
                message:    dto.message,
                type:       dto.type,
                targetType: dto.targetType,
                sentById:   staffId,
                metadata:   dto.metadata,
                sentAt:     new Date(),
            });

        // ── Queue delivery for each channel ───────────────────────────────
        for (const channel of dto.channels) {
            if (channel === "EMAIL" || channel === "SMS") {
                await addNotificationJob({
                    channel:  channel.toLowerCase() as "email" | "sms",
                    to:       [], // resolved by worker based on targetType
                    type:     dto.type,
                    payload:  {
                        title:          dto.title,
                        message:        dto.message,
                        targetType:     dto.targetType,
                        notificationId: notification.id,
                        studentIds:     dto.studentIds,
                        guardianIds:    dto.guardianIds,
                        staffIds:       dto.staffIds,
                    },
                });
            }
        }

        return this.schoolNotificationMapper.toResponse(notification);
    }
}