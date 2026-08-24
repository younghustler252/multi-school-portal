import { INotificationRepository } from "../repositories/notification.repository";
import { ISchoolRepository }       from "../../school/repositories/school.repository";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import { MailService } from "../../../infrastructure/mail/mail.service";
import { PlatformNotificationType } from "../../../generated/public";

interface Dependencies {
    notificationRepository: INotificationRepository;
    schoolRepository:       ISchoolRepository;
    userRepository:         IUserRepository;
    mailService:            MailService;
}

export interface SendPlatformNotificationParams {
    schoolId:          string;
    type:              PlatformNotificationType;
    title:             string;
    message:           string;
    createdByAdminId:  string;
}

export class NotificationService {
    private readonly notificationRepository: INotificationRepository;
    private readonly schoolRepository:       ISchoolRepository;
    private readonly userRepository:         IUserRepository;
    private readonly mailService:            MailService;

    constructor({
        notificationRepository,
        schoolRepository,
        userRepository,
        mailService,
    }: Dependencies) {
        this.notificationRepository = notificationRepository;
        this.schoolRepository       = schoolRepository;
        this.userRepository         = userRepository;
        this.mailService            = mailService;
    }

    async sendPlatformNotification(params: SendPlatformNotificationParams): Promise<void> {
        const notification = await this.notificationRepository.createPlatformNotification({
            title:             params.title,
            message:           params.message,
            type:              params.type,
            createdByAdminId:  params.createdByAdminId,
            state:             "QUEUED",
        });

        const school = await this.schoolRepository.findById(params.schoolId);
        if (!school) return;

        const inAppRecipient = await this.notificationRepository.createPlatformRecipient({
            notificationId: notification.id,
            schoolId:       params.schoolId,
            channel:        "IN_APP",
            status:         "SENT", // in-app has no "delivery" step — it's just visible once queried
        });

        const emailRecipient = await this.notificationRepository.createPlatformRecipient({
            notificationId: notification.id,
            schoolId:       params.schoolId,
            channel:        "EMAIL",
            status:         "PENDING",
        });

        try {
            const adminUser = await this.userRepository.findOne({
                schoolId: params.schoolId,
                role:     "school_admin",
            });

            if (adminUser) {
                await this.mailService.sendLetter(adminUser.email, {
                    subject:    params.title,
                    title:      params.title,
                    greeting:   `Hi ${adminUser.firstName ?? "there"},`,
                    paragraphs: [params.message],
                    footer:     "This is an automated notification from SchoolPortal.",
                });

                await this.notificationRepository.markPlatformRecipientSent(emailRecipient.id);
            }
        } catch (err) {
            await this.notificationRepository.markPlatformRecipientFailed(
                emailRecipient.id,
                err instanceof Error ? err.message : "Unknown error",
            );
        }
    }
}