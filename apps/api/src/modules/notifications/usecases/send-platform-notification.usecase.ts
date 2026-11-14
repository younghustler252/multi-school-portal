import { INotificationRepository }           from "../repositories/notification.repository";
import type { DeliveryQueue } from "../services/notification-dispatch.service";
import { PlatformNotificationMapper }        from "../mappers/notification.mapper";
import { PlatformNotificationResponseData }  from "../mappers/notification.mapper";
import { ISchoolRepository }                 from "../../school/repositories/school.repository";
import { SendPlatformNotificationDtoType }   from "../dtos/notification.dto";
import { createHash } from "node:crypto";
import { ValidationError }                   from "../../../shared/errors/domain.errors";

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
    notificationDeliveryQueue:   DeliveryQueue;
}

/* A stable id for one operator's one request key, so the database primary key makes "the same send twice" a single broadcast. */
const broadcastIdFor = (adminId: string, key: string): string => {
    const h = createHash("sha1").update(`platform-broadcast:${adminId}:${key}`).digest();
    h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;                       // version 5, RFC variant
    const x = h.subarray(0, 16).toString("hex");
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
};
/* A stable fingerprint of everything that decides WHAT is sent and to WHOM: title, message, type, the set of channels, the audience
   (the sorted set of schools, or ALL for broadcastAll / the legacy implicit broadcast) and the free-form metadata. Order and duplicates
   do not matter. The same idempotencyKey must always carry the same fingerprint, or it is refused. */
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)]))
    : v;
export function sendFingerprint(dto: SendPlatformNotificationDtoType): string {
    const audience = dto.schoolIds === undefined ? "ALL" : [...new Set(dto.schoolIds)].sort();
    return createHash("sha256").update(JSON.stringify(canonical({
        title: dto.title, message: dto.message, type: dto.type, channels: [...new Set(dto.channels)].sort(), audience, metadata: dto.metadata ?? null,
    }))).digest("hex");
}
const FINGERPRINT_KEY = "requestFingerprint";
const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "P2002";

export class SendPlatformNotificationUseCase {
    private readonly notificationRepository:     INotificationRepository;
    private readonly platformNotificationMapper: PlatformNotificationMapper;
    private readonly schoolRepository:           ISchoolRepository;
    private readonly notificationDeliveryQueue:  DeliveryQueue;

    constructor({
        notificationRepository,
        platformNotificationMapper,
        schoolRepository,
        notificationDeliveryQueue,
    }: Dependencies) {
        this.notificationRepository     = notificationRepository;
        this.platformNotificationMapper = platformNotificationMapper;
        this.schoolRepository           = schoolRepository;
        this.notificationDeliveryQueue  = notificationDeliveryQueue;
    }

    async execute(
        dto:     SendPlatformNotificationDtoType,
        adminId: string,
    ): Promise<PlatformNotificationResponseData> {

        // ── Who is this for? Decided BEFORE anything is saved ─────────────
        // Only an absent target (or broadcastAll: true) is a broadcast. An explicitly empty list is a mistake, never "everyone".
        const chosen = dto.schoolIds;
        if (chosen !== undefined && chosen.length === 0) throw new ValidationError("Choose at least one school, or set broadcastAll to true");
        if (chosen !== undefined && dto.broadcastAll === true) throw new ValidationError("Send schoolIds or broadcastAll: true, not both");
        if (chosen === undefined && dto.broadcastAll === false) throw new ValidationError("Choose schools in schoolIds, or set broadcastAll to true");

        // Neither field: the legacy "all schools" the web composer still sends (it omits schoolIds and has no broadcastAll yet).
        // Accepted, but never silently: it is logged and marked on the notification. With PLATFORM_BROADCAST_STRICT=true it is refused,
        // which is the switch to flip once the composer sends broadcastAll: true (see docs/backend/modules/notifications.md).
        const implicitBroadcast = chosen === undefined && dto.broadcastAll !== true;
        if (implicitBroadcast && process.env.PLATFORM_BROADCAST_STRICT === "true") {
            throw new ValidationError("Choose schools in schoolIds, or set broadcastAll: true to send to every school");
        }
        if (implicitBroadcast) console.warn(`⚠️ platform notification by ${adminId}: implicit all-schools send (no schoolIds, no broadcastAll). Deprecated; send broadcastAll: true.`);

        // ── Create the notification, or find the one this request key already made ──
        // With an idempotencyKey the id is derived from (operator, key): a retry lands on the same row and RESUMES it.
        const id = dto.idempotencyKey ? broadcastIdFor(adminId, dto.idempotencyKey) : undefined;
        const fingerprint = id ? sendFingerprint(dto) : undefined;
        const extra = { ...(implicitBroadcast && { implicitBroadcast: true }), ...(fingerprint && { [FINGERPRINT_KEY]: fingerprint }) };
        const storedMetadata = Object.keys(extra).length ? { ...(dto.metadata ?? {}), ...extra } : dto.metadata;
        let notification = id ? await this.notificationRepository.findPlatformNotificationById(id) : null;
        if (!notification) {
            try {
                notification = await this.notificationRepository.createPlatformNotification({
                    ...(id && { id }),
                    title:            dto.title,
                    message:          dto.message,
                    type:             dto.type,
                    state:            "QUEUED",
                    createdByAdminId: adminId,
                    metadata:         storedMetadata,
                });
            } catch (err) {
                if (!id || !isUniqueViolation(err)) throw err;                          // two requests with one key at the same moment: the loser resumes
                notification = await this.notificationRepository.findPlatformNotificationById(id);
                if (!notification) throw err;
            }
        }
        // The key already belongs to a broadcast: it must be the SAME request. Checked before any recipient row is touched, so a refused
        // request changes nothing (no rows added, no state change).
        if (id) {
            const stored = (notification.metadata as Record<string, unknown> | null)?.[FINGERPRINT_KEY];
            const same = typeof stored === "string"
                ? stored === fingerprint
                : notification.title === dto.title && notification.message === dto.message && notification.type === dto.type;   // a row without a fingerprint: compare what the row itself holds
            if (!same) throw new ValidationError("This idempotencyKey was already used for a different request (message, type, channels or schools differ). Use a new key for a new send.");
        }

        // ── Resolve target schools ────────────────────────────────────────
        let schoolIds: string[] = [...new Set<string>(chosen ?? [])];

        if (chosen === undefined) {
            // Explicit broadcast (broadcastAll: true, or the legacy "no target") to all active schools
            const schools = await this.schoolRepository.findMany({
                isActive: true,
                status:   "active",
            });
            schoolIds = schools.map(s => s.id);
        }

        // ── Recipient rows: one per school and channel, created only if missing (resume-safe) ─────────────
        // In-app rows are visible at once (SENT). Email and SMS rows wait for the queue, which sends each through the same
        // platform delivery path the worker uses and records the outcome on the row. A row already SENT is never touched or re-sent.
        const now = new Date();
        const rows = await this.notificationRepository.ensurePlatformRecipients(schoolIds.flatMap(schoolId => dto.channels.map(channel => ({
            notificationId: notification!.id,
            schoolId,
            channel,
            idempotencyKey: `${notification!.id}:${schoolId}:${channel}`,
            status: channel === "IN_APP" ? "SENT" as const : "PENDING" as const,
            ...(channel === "IN_APP" && { sentAt: now }),
        }))));
        const toQueue = rows.filter(r => r.channel !== "IN_APP" && (r.status === "PENDING" || r.status === "QUEUED")).map(r => r.id);   // QUEUED again is safe: the job id is the row id
        const waiting = rows.some(r => r.channel !== "IN_APP" && (r.status === "PENDING" || r.status === "QUEUED"));

        // ── Hand email/SMS to the queue; the parent is only COMPLETED when nothing is left waiting ──
        if (toQueue.length === 0) {
            // nothing new to hand over: either everything is already delivered/failed (settle), or rows are still in flight (leave the state)
            if (!waiting) await this.notificationRepository.updatePlatformNotification(notification.id, { state: "COMPLETED", sentAt: notification.sentAt ?? now, completedAt: notification.completedAt ?? now });
            const current = await this.notificationRepository.findPlatformNotificationById(notification.id);
            return this.platformNotificationMapper.toResponse(current ?? notification);
        }

        // PROCESSING is set BEFORE queueing so a fast worker that settles the last row is never overwritten by this write.
        await this.notificationRepository.updatePlatformNotification(notification.id, { state: "PROCESSING", sentAt: now });
        try {
            // tenantSchema is unused for platform jobs (they run outside any school's database)
            await this.notificationDeliveryQueue.enqueue(toQueue.map(recipientId => ({ kind: "platform" as const, recipientId, schoolId: "", tenantSchema: "" })));
            await this.notificationRepository.markPlatformRecipientsQueued(toQueue);
        } catch (err) {
            // Rows stay PENDING and the parent goes back to QUEUED, so the send is visibly unfinished instead of falsely completed.
            console.error(`⚠️ Could not queue ${toQueue.length} platform message(s) for notification ${notification.id}:`, err instanceof Error ? err.message : err);
            await this.notificationRepository.updatePlatformNotification(notification.id, { state: "QUEUED" });
        }
        const current = await this.notificationRepository.findPlatformNotificationById(notification.id);
        return this.platformNotificationMapper.toResponse(current ?? notification);
    }
}
