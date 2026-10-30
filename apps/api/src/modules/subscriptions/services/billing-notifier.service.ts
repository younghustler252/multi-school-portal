import { PrismaClient } from "../../../generated/public/client";
import { NotificationService } from "../../notifications/services/notification.service";
import { BillingMessage } from "./billing.messages";
import { SYSTEM_BILLING_ACTOR } from "../domain/billing.policy";

interface Dependencies { prismaClient: PrismaClient; notificationService: NotificationService }

export class BillingNotifier {
    private readonly prisma: PrismaClient;
    private readonly notifications: NotificationService;
    constructor({ prismaClient, notificationService }: Dependencies) { this.prisma = prismaClient; this.notifications = notificationService; }

    // Notifications never break billing: a failure to notify is logged, not thrown
    async send(schoolId: string, m: BillingMessage): Promise<void> {
        try {
            await this.notifications.sendPlatformNotification({
                schoolId, type: m.type, title: m.title, message: m.message, createdByAdminId: SYSTEM_BILLING_ACTOR,
            });
        } catch (err) { console.error(`[billing] could not notify school ${schoolId}:`, (err as Error).message); }
    }

    /** Sends once per (subscription, period, key). Safe to call every hour. Returns true when it was sent. */
    async sendOnce(subscriptionId: string, periodEnd: Date, key: string, schoolId: string, m: BillingMessage): Promise<boolean> {
        try { await this.prisma.billingNotice.create({ data: { subscriptionId, periodEnd, key } }); }
        catch (err: any) { if (err?.code === "P2002") return false; throw err; }
        await this.send(schoolId, m);
        return true;
    }
}
