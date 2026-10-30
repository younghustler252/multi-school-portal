import { INotificationRepository }           from "../repositories/notification.repository";
import { PlatformNotificationMapper }        from "../mappers/notification.mapper";
import { PlatformNotificationResponseData }  from "../mappers/notification.mapper";
import { MailService }                       from "../../../infrastructure/mail/mail.service";
import { ISchoolRepository }                 from "../../school/repositories/school.repository";
import { SendPlatformNotificationDtoType }   from "../dtos/notification.dto";
import { prisma }                            from "../../../infrastructure/database/prisma/prisma.client";

/*
|--------------------------------------------------------------------------
| SEND PLATFORM NOTIFICATION USE CASE
| Super admin sends platform-wide announcements to school admins
|--------------------------------------------------------------------------
*/

interface Dependencies {
    notificationRepository:      INotificationRepository;
    platformNotificationMapper:  PlatformNotificationMapper;
    schoolRepository:            ISchoolRepository;
    mailService:                 MailService;
}

export class SendPlatformNotificationUseCase {
    private readonly notificationRepository:     INotificationRepository;
    private readonly platformNotificationMapper: PlatformNotificationMapper;
    private readonly schoolRepository:           ISchoolRepository;
    private readonly mailService:                MailService;

    constructor({
        notificationRepository,
        platformNotificationMapper,
        schoolRepository,
        mailService,
    }: Dependencies) {
        this.notificationRepository     = notificationRepository;
        this.platformNotificationMapper = platformNotificationMapper;
        this.schoolRepository           = schoolRepository;
        this.mailService                = mailService;
    }

    async execute(
        dto:     SendPlatformNotificationDtoType,
        adminId: string,
    ): Promise<PlatformNotificationResponseData> {

        // ── Create notification ───────────────────────────────────────────
        const notification = await this.notificationRepository
            .createPlatformNotification({
                title:            dto.title,
                message:          dto.message,
                type:             dto.type,
                state:            "QUEUED",
                createdByAdminId: adminId,
                metadata:         dto.metadata,
            });

        // ── Resolve target schools ────────────────────────────────────────
        let schoolIds = dto.schoolIds ?? [];

        if (schoolIds.length === 0) {
            // Broadcast to all active schools
            const schools = await this.schoolRepository.findMany({
                isActive: true,
                status:   "active",
            });
            schoolIds = schools.map(s => s.id);
        }

        // ── Create recipient records ──────────────────────────────────────
        for (const schoolId of schoolIds) {
            for (const channel of dto.channels) {
                await prisma.platformNotificationRecipient.create({
                    data: {
                        notificationId: notification.id,
                        schoolId,
                        channel,
                        status: "PENDING",
                    },
                });
            }
        }

        // ── Send emails to school admins ──────────────────────────────────
        if (dto.channels.includes("EMAIL")) {
            const admins = await prisma.user.findMany({
                where: {
                    schoolId: { in: schoolIds },
                    role:     "school_admin",
                    isActive: true,
                },
                select: { email: true, firstName: true },
            });

            for (const admin of admins) {
                await this.mailService.sendLetter(admin.email, {
                    subject:    dto.title,
                    title:      dto.title,
                    greeting:   `Hi ${admin.firstName ?? "School Admin"},`,
                    paragraphs: [dto.message],
                });
            }
        }

        // ── Update notification state ─────────────────────────────────────
        const updated = await this.notificationRepository
            .updatePlatformNotification(notification.id, {
                state:       "COMPLETED",
                sentAt:      new Date(),
                completedAt: new Date(),
            });

        return this.platformNotificationMapper.toResponse(updated);
    }
}