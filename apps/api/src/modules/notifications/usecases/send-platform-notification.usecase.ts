import { INotificationRepository }           from "../repositories/notification.repository";
import type { DeliveryQueue } from "../services/notification-dispatch.service";
import { PlatformNotificationMapper }        from "../mappers/notification.mapper";
import { PlatformNotificationResponseData }  from "../mappers/notification.mapper";
import { ISchoolRepository }                 from "../../school/repositories/school.repository";
import { SendPlatformNotificationDtoType }   from "../dtos/notification.dto";
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
        let schoolIds: string[] = [...new Set<string>(chosen ?? [])];

        if (chosen === undefined) {
            // Explicit broadcast (broadcastAll: true, or the legacy "no target") to all active schools
            const schools = await this.schoolRepository.findMany({
                isActive: true,
                status:   "active",
            });
            schoolIds = schools.map(s => s.id);
        }

        // ── Create recipient records ──────────────────────────────────────
        // In-app rows are visible at once (SENT). Email and SMS rows wait for the queue, which sends each through the same
        // platform delivery path the worker uses and records the outcome on the row.
        const now = new Date();
        const toQueue: string[] = [];
        for (const schoolId of schoolIds) {
            for (const channel of dto.channels) {
                const inApp = channel === "IN_APP";
                const row = await this.notificationRepository.createPlatformRecipient({
                    notificationId: notification.id,
                    schoolId,
                    channel,
                    status: inApp ? "SENT" : "PENDING",
                    ...(inApp && { sentAt: now }),
                });
                if (!inApp) toQueue.push(row.id);
            }
        }

        // ── Hand email/SMS to the queue; the parent is only COMPLETED when nothing is left waiting ──
        if (toQueue.length === 0) {
            const updated = await this.notificationRepository.updatePlatformNotification(notification.id, { state: "COMPLETED", sentAt: now, completedAt: now });
            return this.platformNotificationMapper.toResponse(updated);
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
