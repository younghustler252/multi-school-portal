// infrastructure/jobs/workers/defaulter-reminder.worker.ts
import { Worker, Job } from "bullmq";
import { redisConnection } from "../connection";
import { TenantContext } from "../../database/prisma/tenant.context";
import { getTenantClient } from "../../database/prisma/prisma.client";
import { prisma } from "../../database/prisma/prisma.client";
import { container } from "../../../container";
import { MailService } from "../../mail/mail.service";
import { DefaulterReminderJobData } from "../queues/defaulter-reminder.queue";
import { INotificationRepository } from "../../../modules/notifications/repositories/notification.repository";
import { NotificationService } from "../../../modules/notifications/services/notification.service";
import { AuditService } from "../../../modules/audit/services/audit.service";
import { ActorType } from "../../../modules/audit/domain/audit.enums";

const ACTOR_ID = "SYSTEM_DEFAULTER_REMINDER";

export const defaulterReminderWorker =
    new Worker<DefaulterReminderJobData>(
        "defaulter-reminder",
        async (job: Job<DefaulterReminderJobData>) => {
            console.log(
                `📨 Processing defaulter reminder job: ${job.id}`,
            );
        const mailService = container.resolve<MailService>("mailService");
        const notificationRepository = container.resolve<INotificationRepository>("notificationRepository");
        const notificationService = container.resolve<NotificationService>("notificationService");
        const auditService = container.resolve<AuditService>("auditService");

        const schools = await prisma.school.findMany({
            where: { schemaProvisionedAt: { not: null }, isActive: true },
            select: { id: true, name: true, schemaName: true },
        });

        for (const school of schools) {
            if (!school.schemaName) continue;

            let remindersSent = 0;
            let studentsAffected = 0;

            await TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id }, async () => {
                const db = getTenantClient();
                const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });
                if (!currentTerm) return;

                const upcoming = await db.feeInvoice.findMany({
                    where: {
                        termId: currentTerm.id,
                        status: { in: ["unpaid", "partial"] },
                        dueDate: {
                            gte: new Date(),
                            lte: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                        },
                    },
                    select: { studentId: true },
                });

                studentsAffected = upcoming.length;
                if (upcoming.length === 0) return;

                for (const invoice of upcoming) {
                    const links = await db.studentGuardian.findMany({
                        where: { studentId: invoice.studentId },
                        include: { guardian: true },
                    });

                    if (links.length === 0) continue;

                    const notification = await notificationRepository.createSchoolNotification({
                        title:      "Fee payment reminder",
                        message:    "A fee payment for your child is due soon. Please log in to view the invoice and make payment.",
                        type:       "fee_reminder",
                        targetType: "GUARDIAN",
                        sentById:   ACTOR_ID,
                        sentAt:     new Date(),
                    });

                    for (const link of links) {
                        await notificationRepository.createRecipient({
                            notificationId: notification.id,
                            guardianId:     link.guardianId,
                            channel:        "IN_APP",
                            status:         "SENT",
                        });

                        try {
                            await mailService.sendLetter(link.guardian.email, {
                                subject:  "Fee payment reminder",
                                title:    "Upcoming fee due",
                                greeting: `Hi ${link.guardian.firstName},`,
                                paragraphs: [
                                    `This is a reminder that a fee payment for your child is due soon.`,
                                    `Please log in to your parent portal to view the full invoice and make payment.`,
                                ],
                                footer: `— ${school.name}`,
                            });

                            await notificationRepository.createRecipient({
                                notificationId: notification.id,
                                guardianId:     link.guardianId,
                                channel:        "EMAIL",
                                status:         "SENT",
                            });

                            remindersSent++;
                        } catch (err) {
                            await notificationRepository.createRecipient({
                                notificationId: notification.id,
                                guardianId:     link.guardianId,
                                channel:        "EMAIL",
                                status:         "FAILED",
                                failedReason:   err instanceof Error ? err.message : "Unknown error",
                            });
                        }
                    }
                }
            });

            await auditService.log({
                schoolId:  school.id,
                actorType: ActorType.SYSTEM,
                action:    "fee.defaulter_reminder.run",
                entity:    "School",
                entityId:  school.id,
                metadata:  { studentsAffected, remindersSent },
            });

            if (studentsAffected > 0) {
                await notificationService.sendPlatformNotification({
                    schoolId:          school.id,
                    type:             "system_alert",
                    title:            "Fee reminders sent",
                    message:          `${remindersSent} payment reminder(s) sent to guardians for ${studentsAffected} student(s) with fees due soon.`,
                    createdByAdminId: ACTOR_ID,
                });
            }
        }
    },
    { connection: redisConnection, concurrency: 1 },
);