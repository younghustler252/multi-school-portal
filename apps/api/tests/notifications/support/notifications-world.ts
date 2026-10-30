/*
| An in-memory notifications world over the REAL dispatch, delivery and send services: the repository is a small fake that obeys the
| same unique rules the database does (one idempotency key, one row per message + channel + person), the queue and the channels are recorders.
*/
import { NotificationDispatchService } from "../../../src/modules/notifications/services/notification-dispatch.service";
import { NotificationDeliveryService } from "../../../src/modules/notifications/services/notification-delivery.service";
import { SendSchoolNotificationUseCase } from "../../../src/modules/notifications/usecases/send-school-notification.usecase";
import { SchoolNotificationMapper } from "../../../src/modules/notifications/mappers/notification.mapper";
import { ChannelRegistry } from "../../../src/infrastructure/notifications/channel.registry";

export const NOW = new Date("2026-10-30T08:00:00Z");
export const code = (c: string) => (e: any) => e.code === c;

export function notificationsWorld(opts: { plan?: { email?: boolean; sms?: boolean }; prefs?: Record<string, unknown>; queueDown?: boolean } = {}) {
    const notifications: any[] = [];
    const rows: any[] = [];
    let seq = 0;

    const people = {
        guardians: [
            { id: "g1", firstName: "Ada", email: "ada@x.ng", phone: "0801", userId: "ug1" },
            { id: "g2", firstName: "Bola", email: "bola@x.ng", phone: null, userId: null },
        ],
        students: [{ id: "s1", firstName: "Tolu", userId: "us1", isActive: true }],
        staff: [{ id: "t1", userId: "ut1", isActive: true }],
        users: [
            { id: "us1", email: "tolu@x.ng", phone: "0803", firstName: "Tolu" },
            { id: "ut1", email: "teacher@x.ng", phone: "0804", firstName: "Tayo" },
        ],
    };

    const repo: any = {
        async createSchoolNotification(data: any) { const n = { id: `n${++seq}`, metadata: null, createdAt: NOW, updatedAt: NOW, ...data }; notifications.push(n); return n; },
        async findSchoolNotificationById(id: string) { return notifications.find(n => n.id === id) ?? null; },
        async findExistingIdempotencyKeys(keys: string[]) { return new Set(rows.filter(r => r.idempotencyKey && keys.includes(r.idempotencyKey)).map(r => r.idempotencyKey)); },
        async createSchoolRecipientsBatch(batch: any[]) {
            let n = 0;
            for (const b of batch) {
                const clash = rows.some(r => (b.idempotencyKey && r.idempotencyKey === b.idempotencyKey)
                    || (r.notificationId === b.notificationId && r.channel === b.channel && r.recipientType === b.recipientType && r.recipientEntityId === b.recipientEntityId));
                if (clash) continue;
                rows.push({ id: `r${++seq}`, retryCount: 0, readAt: null, updatedAt: NOW, createdAt: NOW, failedReason: null, ...b }); n++;
            }
            return n;
        },
        async findSchoolRecipientById(id: string) { return rows.find(r => r.id === id) ?? null; },
        async findUnqueuedDeliverables(notificationId: string) { return rows.filter(r => r.notificationId === notificationId && r.status === "PENDING" && r.channel !== "IN_APP").map(r => ({ id: r.id, channel: r.channel })); },
        async findStaleDeliverables(olderThan: Date, limit: number) { return rows.filter(r => ["PENDING", "QUEUED"].includes(r.status) && r.channel !== "IN_APP" && r.updatedAt < olderThan).slice(0, limit).map(r => ({ id: r.id, channel: r.channel })); },
        async markSchoolRecipientsQueued(ids: string[]) { for (const r of rows) if (ids.includes(r.id) && ["PENDING", "QUEUED"].includes(r.status)) { r.status = "QUEUED"; r.updatedAt = NOW; } },
        async markSchoolRecipientSent(id: string) { const r = rows.find(x => x.id === id); r.status = "SENT"; r.failedReason = null; },
        async markSchoolRecipientFailed(id: string, reason: string) { const r = rows.find(x => x.id === id); r.status = "FAILED"; r.failedReason = reason; r.retryCount++; },
        async findMySchoolNotifications(owner: any) { const data = rows.filter(r => r.recipientType === owner.recipientType && r.recipientEntityId === owner.recipientEntityId && r.channel === "IN_APP"); return { data, meta: { total: data.length } }; },
        async markSchoolRecipientRead(id: string, owner: any) { const r = rows.find(x => x.id === id && x.recipientType === owner.recipientType && x.recipientEntityId === owner.recipientEntityId && x.channel === "IN_APP"); if (!r) return false; r.readAt = NOW; r.status = "READ"; return true; },
        async markAllSchoolRecipientsRead(owner: any) { const mine = rows.filter(r => r.recipientType === owner.recipientType && r.recipientEntityId === owner.recipientEntityId && r.channel === "IN_APP" && !r.readAt); mine.forEach(r => { r.readAt = NOW; r.status = "READ"; }); return mine.length; },
    };

    const queued: any[] = [];
    const queue = { async enqueue(jobs: any[]) { if (opts.queueDown) throw new Error("redis is down"); queued.push(...jobs); } };
    const sent: any[] = [];
    const channels = new ChannelRegistry();
    let channelFails: string | null = null;
    for (const channel of ["EMAIL", "SMS", "IN_APP"] as const) {
        channels.register({ channel, async send(p: any) { sent.push({ channel, ...p }); return channelFails ? { success: false, error: channelFails } : { success: true, providerMessageId: "pm1" }; } });
    }

    const audit: any[] = [];
    const plan = { email: true, sms: true, ...(opts.plan ?? {}) };
    const entitlementsService = { async checkFeature(_s: string, key: string) {
        const ok = key === "notifications.email" ? plan.email : key === "notifications.sms" ? plan.sms : true;
        return ok ? { allowed: true } : { allowed: false, reason: "not_granted" };
    } };
    const prefs = { "notifications.email_enabled": true, "notifications.sms_enabled": true, ...(opts.prefs ?? {}) };

    const dispatch = new NotificationDispatchService(
        { notificationRepository: repo, notificationDeliveryQueue: queue, tenantInfo: () => ({ schoolId: "sch", tenantSchema: "school_sch" }) },
        { now: () => NOW });

    const delivery = new NotificationDeliveryService({
        notificationRepository: repo, channelRegistry: channels,
        studentRepository: { async findById(id: string) { return people.students.find(s => s.id === id) ?? null; } } as any,
        guardianRepository: { async findById(id: string) { return people.guardians.find(g => g.id === id) ?? null; } } as any,
        staffRepository: { async findById(id: string) { return people.staff.find(s => s.id === id) ?? null; } } as any,
        userRepository: { async findById(id: string) { return people.users.find(u => u.id === id) ?? null; } } as any,
    });

    const send = new SendSchoolNotificationUseCase({
        notificationRepository: repo, schoolNotificationMapper: new SchoolNotificationMapper(), notificationDispatchService: dispatch,
        entitlementsService: entitlementsService as any, auditService: { async log(p: any) { audit.push(p); } } as any,
        schoolPreferencesService: { async all() { return prefs as any; } },
        studentRepository: { async findMany() { return people.students; } } as any,
        guardianRepository: { async findMany(where: any) { return where?.id?.in ? people.guardians.filter(g => where.id.in.includes(g.id)) : people.guardians; } } as any,
        staffRepository: { async findMany() { return people.staff; } } as any,
        userRepository: { async findByIds(ids: string[]) { return people.users.filter(u => ids.includes(u.id)); } } as any,
    });

    return { notifications, rows, queued, sent, audit, repo, dispatch, delivery, send, failChannels: (m: string | null) => { channelFails = m; } };
}
