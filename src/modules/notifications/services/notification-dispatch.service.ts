import { INotificationRepository } from "../repositories/notification.repository";
import { RecipientKind } from "../domain/notification.entity";
import type { NotificationDeliveryJob } from "../../../infrastructure/jobs/queues/notification.queue";

export type DispatchChannel = "IN_APP" | "EMAIL" | "SMS";
export type DispatchPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type TargetKind = "STUDENT" | "GUARDIAN" | "STAFF" | "ALL_PARENTS" | "ALL_STUDENTS" | "ALL_STAFF" | "EVERYONE";

export interface OutgoingMessage {
    type:     string;                       // SchoolNotificationType: fee_reminder, broadcast, ...
    channel:  DispatchChannel;
    title:    string;                       // one line
    message:  string;                       // plain text
    recipient: { recipientType: RecipientKind; recipientEntityId: string; userId?: string | null };
    /** When set, a message with this key is never created twice (a repeated run of the same rule does nothing). */
    idempotencyKey?: string | null;
    priority?: DispatchPriority;
}

export interface DispatchInput {
    sentById:   string;
    targetType: TargetKind;
    /** Stored on every message created by this call (for example { source: "automation", ruleId }). `delivery` flags are read by the channels. */
    metadata?:  Record<string, unknown>;
    messages:   OutgoingMessage[];
}

export interface DispatchResult {
    notificationIds: string[];
    created:         number;
    duplicates:      number;
    queued:          number;
    byChannel:       Record<DispatchChannel, number>;
}

export interface DeliveryQueue { enqueue(jobs: NotificationDeliveryJob[]): Promise<void> }

interface Dependencies {
    notificationRepository:  INotificationRepository;
    notificationDeliveryQueue: DeliveryQueue;
    /** The current school (id and database schema). Injected so tests need no request. */
    tenantInfo?: () => { schoolId: string; tenantSchema: string };
}
interface Options { now?: () => Date }

/*
|--------------------------------------------------------------------------
| NOTIFICATION DISPATCH SERVICE
| The one road every school message takes (announcements, fee reminders, automation):
|   1. messages whose idempotency key already exists are dropped (counted as duplicates)
|   2. messages with the same words share ONE notification; each person and channel is one recipient row
|   3. in-app rows are visible at once (status SENT); email and SMS rows are handed to the delivery queue
| Rows are written first and queued after. If the queue is down the rows stay PENDING and requeueStale() picks them up
| (the automation tick calls it), so a message is never lost and never sent twice.
|--------------------------------------------------------------------------
*/
export class NotificationDispatchService {
    private readonly now: () => Date;

    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); }

    private tenant() {
        if (this.d.tenantInfo) return this.d.tenantInfo();
        // Loaded on first use so that importing this file never needs a database connection
        const { TenantContext } = require("../../../infrastructure/database/prisma/tenant.context") as typeof import("../../../infrastructure/database/prisma/tenant.context");
        const ctx = TenantContext.get();
        return { schoolId: ctx.schoolId, tenantSchema: ctx.tenantSchema };
    }

    async dispatch(input: DispatchInput): Promise<DispatchResult> {
        const result: DispatchResult = { notificationIds: [], created: 0, duplicates: 0, queued: 0, byChannel: { IN_APP: 0, EMAIL: 0, SMS: 0 } };

        // 1. the same key twice in one call counts once; keys that already exist are dropped
        const seen = new Set<string>();
        let messages = input.messages.filter(m => {
            if (!m.idempotencyKey) return true;
            if (seen.has(m.idempotencyKey)) { result.duplicates++; return false; }
            seen.add(m.idempotencyKey);
            return true;
        });
        const keys = messages.map(m => m.idempotencyKey).filter((k): k is string => !!k);
        if (keys.length) {
            const existing = await this.d.notificationRepository.findExistingIdempotencyKeys(keys);
            messages = messages.filter(m => {
                if (m.idempotencyKey && existing.has(m.idempotencyKey)) { result.duplicates++; return false; }
                return true;
            });
        }
        if (messages.length === 0) return result;

        // 2. one notification per distinct wording
        const groups = new Map<string, OutgoingMessage[]>();
        for (const m of messages) {
            const k = `${m.type}\u0000${m.title}\u0000${m.message}`;
            (groups.get(k) ?? groups.set(k, []).get(k)!).push(m);
        }

        const now = this.now();
        const toQueue: { id: string; channel: "EMAIL" | "SMS" }[] = [];
        for (const group of groups.values()) {
            const first = group[0];
            const notification = await this.d.notificationRepository.createSchoolNotification({
                title: first.title, message: first.message, type: first.type as any, targetType: input.targetType as any,
                sentById: input.sentById, metadata: (input.metadata ?? undefined) as any, sentAt: now,
            });
            result.notificationIds.push(notification.id);

            const inserted = await this.d.notificationRepository.createSchoolRecipientsBatch(group.map(m => ({
                notificationId:    notification.id,
                recipientType:     m.recipient.recipientType,
                recipientEntityId: m.recipient.recipientEntityId,
                userId:            m.recipient.userId ?? null,
                channel:           m.channel,
                priority:          m.priority ?? "NORMAL",
                idempotencyKey:    m.idempotencyKey ?? null,
                status:            m.channel === "IN_APP" ? "SENT" : "PENDING",
                sentAt:            m.channel === "IN_APP" ? now : null,
            })));
            result.created += inserted;
            for (const m of group) result.byChannel[m.channel]++;   // an upper bound: a row skipped by a unique rule is not subtracted per channel

            if (group.some(m => m.channel !== "IN_APP")) toQueue.push(...(await this.d.notificationRepository.findUnqueuedDeliverables(notification.id)));
        }

        // 3. hand email and SMS to the queue
        result.queued = await this.enqueue(toQueue);
        return result;
    }

    /** Hands rows to the queue and marks them QUEUED. If the queue refuses, they stay as they are and a later call retries. */
    private async enqueue(rows: { id: string; channel: "EMAIL" | "SMS" }[]): Promise<number> {
        if (rows.length === 0) return 0;
        const { schoolId, tenantSchema } = this.tenant();
        try {
            await this.d.notificationDeliveryQueue.enqueue(rows.map(r => ({ kind: "school" as const, recipientId: r.id, schoolId, tenantSchema })));
        } catch (err) {
            console.error(`⚠️ Could not queue ${rows.length} message(s) for school ${schoolId}; they stay PENDING and will be retried:`, err instanceof Error ? err.message : err);
            return 0;
        }
        await this.d.notificationRepository.markSchoolRecipientsQueued(rows.map(r => r.id));
        return rows.length;
    }

    /** Email and SMS rows that never reached the queue, or sat in it far too long. Safe to call often. */
    async requeueStale(olderThanMs = 10 * 60 * 1000, limit = 500): Promise<number> {
        const rows = await this.d.notificationRepository.findStaleDeliverables(new Date(this.now().getTime() - olderThanMs), limit);
        return this.enqueue(rows);
    }
}
