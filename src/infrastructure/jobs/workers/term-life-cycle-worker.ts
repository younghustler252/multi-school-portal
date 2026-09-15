import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { TenantContext } from "../../database/prisma/tenant.context";
import { getTenantClient } from "../../database/prisma/prisma.client";
import { prisma } from "../../database/prisma/prisma.client";
import { container } from "../../../container";
import { NotificationService } from "../../../modules/notifications/services/notification.service";

const ACTOR_ID = "SYSTEM_TERM_LIFECYCLE";

export const termLifecycleWorker = new Worker(
    "term-lifecycle",
    async () => {
        const notificationService = container.resolve<NotificationService>("notificationService");
        const settings = await prisma.platformSettings.findFirst();
        const reminderDays = settings?.termEndingReminderDays ?? 7;
        const now = new Date();

        const schools = await prisma.school.findMany({
            where: { schemaProvisionedAt: { not: null }, isActive: true },
            select: { id: true, name: true, schemaName: true },
        });

        for (const school of schools) {
            if (!school.schemaName) continue;

            await TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id }, async () => {
                const db = getTenantClient();
                const currentTerm = await db.term.findFirst({ where: { isCurrent: true } });
                if (!currentTerm) return;

                const daysLeft = Math.ceil((currentTerm.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

                if (daysLeft === reminderDays) {
                    await notificationService.sendPlatformNotification({
                        schoolId: school.id,
                        type: "system_alert",
                        title: `${currentTerm.name} ending in ${reminderDays} days`,
                        message: "Make sure grades and attendance are finalized before the term ends.",
                        createdByAdminId: ACTOR_ID,
                    });
                }

                if (daysLeft === 0) {
                    await notificationService.sendPlatformNotification({
                        schoolId: school.id,
                        type: "system_alert",
                        title: "Term has ended",
                        message: "Set the next term as current, or start promoting students to the new session when ready.",
                        createdByAdminId: ACTOR_ID,
                    });
                }
            });
        }
    },
    { connection: redisConnection, concurrency: 1 },
);