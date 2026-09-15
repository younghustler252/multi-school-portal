// infrastructure/jobs/workers/subscription-expiry.worker.ts
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { prisma } from "../../database/prisma/prisma.client";
import { container } from "../../../container";
import { NotificationService } from "../../../modules/notifications/services/notification.service";
import { AuditService } from "../../../modules/audit/services/audit.service";
import { ActorType } from "../../../modules/audit/domain/audit.enums";

const ACTOR_ID = "SYSTEM_SUBSCRIPTION_EXPIRY";

export const subscriptionExpiryWorker = new Worker(
    "subscription-expiry",
    async () => {
        const notificationService = container.resolve<NotificationService>("notificationService");
        const auditService = container.resolve<AuditService>("auditService");

        const settings = await prisma.platformSettings.findFirst();
        const graceDays    = settings?.subscriptionGracePeriodDays ?? 7;
        const reminderDays = settings?.reminderDaysBeforeExpiry    ?? 7;

        const freePlan = await prisma.plan.findFirst({ where: { name: "Free" } });
        if (!freePlan) {
            console.error("❌ subscription-expiry: no Free plan found, cannot process downgrades");
            return;
        }

        const now = new Date();

        // ── Upcoming expiry reminders ────────────────────────────────────
        const reminderDate = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000);
        const dueForReminder = await prisma.subscription.findMany({
            where: {
                status: { in: ["active", "trialing"] },
                currentPeriodEnd: {
                    gte: now,
                    lte: reminderDate,
                },
            },
            include: { school: true, plan: true },
        });

        for (const sub of dueForReminder) {
            await notificationService.sendPlatformNotification({
                schoolId:          sub.schoolId,
                type:              "subscription_expiry",
                title:             "Your subscription is expiring soon",
                message:           `Your ${sub.plan.name} plan expires on ${sub.currentPeriodEnd.toLocaleDateString("en-NG")}. Renew to avoid interruption.`,
                createdByAdminId:  ACTOR_ID,
            });
        }

        // ── Auto-renew subscriptions that have reached period end ─────────
        const dueForAutoRenewal = await prisma.subscription.findMany({
            where: {
                autoRenew: true,
                paystackAuthorizationCode: { not: null },
                status: { in: ["active", "trialing"] },
                currentPeriodEnd: { lte: now },
            },
            include: { school: true, plan: true },
        });

        for (const sub of dueForAutoRenewal) {
            const amountKobo = sub.billingCycle === "yearly"
                ? sub.plan.yearlyPriceKobo
                : sub.plan.monthlyPriceKobo;

            try {
                const result = await paymentProvider.chargeAuthorization({
                    customerEmail:     sub.school.email,
                    amountKobo,
                    authorizationCode: sub.paystackAuthorizationCode!,
                });

                if (result.status === "success") {
                    const end = new Date();
                    sub.billingCycle === "yearly"
                        ? end.setFullYear(end.getFullYear() + 1)
                        : end.setMonth(end.getMonth() + 1);

                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: {
                            currentPeriodStart: now,
                            currentPeriodEnd:   end,
                            nextBillingDate:    end,
                            failedBillingCount: 0,
                        },
                    });

                    await prisma.billingHistory.create({
                        data: {
                            subscriptionId: sub.id,
                            amountKobo,
                            status: "success",
                            billingCycle: sub.billingCycle,
                            paidAt: now,
                        },
                    });
                } else {
                    throw new Error("Charge failed");
                }
            } catch {
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: {
                        failedBillingCount: { increment: 1 },
                        lastBillingAttemptAt: now,
                    },
                });
                // falls through to the existing past_due/grace-period logic below, same as a school that never had auto-renew at all
            }
        }

        // ── Scheduled downgrade reached period end ────────────────────────
        const dueForScheduledDowngrade = await prisma.subscription.findMany({
            where: {
                scheduledDowngradePlanId: { not: null },
                currentPeriodEnd:         { lt: now },
            },
        });

        for (const sub of dueForScheduledDowngrade) {
            const newPlan = await prisma.plan.findUnique({
                where: { id: sub.scheduledDowngradePlanId! },
            });
            if (!newPlan) continue;

            const end = new Date();
            end.setMonth(end.getMonth() + 1);

            await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    planId: newPlan.id,
                    scheduledDowngradePlanId: null,
                    status: "active",
                    currentPeriodStart: now,
                    currentPeriodEnd: end,
                    nextBillingDate: end,
                },
            });

            await notificationService.sendPlatformNotification({
                schoolId: sub.schoolId,
                type: "subscription_renewed",
                title: "Plan downgraded",
                message: `You've moved to the ${newPlan.name} plan as requested.`,
                createdByAdminId: ACTOR_ID,
            });
        }

        // ── Just expired → past_due ────────────────────────────────────────
        const justExpired = await prisma.subscription.findMany({
            where: {
                status:           { in: ["active", "trialing"] },
                currentPeriodEnd: { lt: now },
            },
            include: { plan: true },
        });

        for (const sub of justExpired) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data:  { status: "past_due" },
            });

            await notificationService.sendPlatformNotification({
                schoolId:         sub.schoolId,
                type:             "subscription_failed",
                title:            "Your subscription has expired",
                message:          `Your ${sub.plan.name} plan has expired. You have ${graceDays} day(s) to renew before being moved to the Free plan.`,
                createdByAdminId: ACTOR_ID,
            });

            await auditService.log({
                schoolId: sub.schoolId, actorType: ActorType.SYSTEM,
                action: "subscription.past_due", entity: "Subscription", entityId: sub.id,
            });
        }

        // ── Grace period elapsed → downgrade to Free ──────────────────────
        const gracePeriodCutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);
        const toDowngrade = await prisma.subscription.findMany({
            where: {
                status:           "past_due",
                currentPeriodEnd: { lt: gracePeriodCutoff },
            },
        });

        for (const sub of toDowngrade) {
            const periodEnd = new Date();
            periodEnd.setFullYear(periodEnd.getFullYear() + 1); // Free plan — nominal long period, not billed

            await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    planId:             freePlan.id,
                    status:             "active",
                    billingCycle:       "monthly",
                    currentPeriodStart: now,
                    currentPeriodEnd:   periodEnd,
                    nextBillingDate:    null,
                },
            });

            await notificationService.sendPlatformNotification({
                schoolId:         sub.schoolId,
                type:             "subscription_failed",
                title:            "You've been moved to the Free plan",
                message:          `Your subscription grace period ended without renewal. Your account is now on the Free plan. Upgrade anytime to restore your previous features.`,
                createdByAdminId: ACTOR_ID,
            });

            await auditService.log({
                schoolId: sub.schoolId, actorType: ActorType.SYSTEM,
                action: "subscription.downgraded_to_free", entity: "Subscription", entityId: sub.id,
            });
        }
    },
    { connection: redisConnection, concurrency: 1 },
);
