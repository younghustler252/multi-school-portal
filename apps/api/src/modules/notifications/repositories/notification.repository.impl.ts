import { Prisma } from "../../../generated/tenant";
import { Prisma as publicPrisma } from "../../../generated/public";
import { prisma, getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { PlatformNotificationMapper, SchoolNotificationMapper } from "../mappers/notification.mapper";
import {
    PlatformNotificationEntity,
    PlatformNotificationRecipientEntity,
    SchoolNotificationEntity,
    SchoolNotificationRecipientEntity,
} from "../domain/notification.entity";
import { DeliverableRef, INotificationRepository, RecipientOwner } from "./notification.repository";
import { PaginateParams, PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { parsePagination, buildPaginationMeta } from "../../../shared/utils/pagination";

const CHUNK = 1000;

export class NotificationRepositoryImpl implements INotificationRepository {
    private readonly platformMapper: PlatformNotificationMapper;
    private readonly schoolMapper:   SchoolNotificationMapper;

    private get tenantDb() { return getTenantClient(); }

    constructor({ platformNotificationMapper, schoolNotificationMapper }: {
        platformNotificationMapper: PlatformNotificationMapper;
        schoolNotificationMapper:   SchoolNotificationMapper;
    }) {
        this.platformMapper = platformNotificationMapper;
        this.schoolMapper   = schoolNotificationMapper;
    }

    // ── Platform notifications (public schema) ────────────────────────────
    async createPlatformNotification(data: publicPrisma.PlatformNotificationUncheckedCreateInput): Promise<PlatformNotificationEntity> {
        return this.platformMapper.toDomain(await prisma.platformNotification.create({ data }));
    }

    async updatePlatformNotification(id: string, data: Record<string, any>): Promise<PlatformNotificationEntity> {
        return this.platformMapper.toDomain(await prisma.platformNotification.update({ where: { id }, data }));
    }

    async paginatePlatformNotifications(params: PaginateParams): Promise<PaginatedResult<PlatformNotificationEntity>> {
        const { page, limit, skip } = parsePagination({ page: params.page, limit: params.limit });
        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };
        const [raws, total] = await Promise.all([
            prisma.platformNotification.findMany({ where, skip, take: limit, orderBy }),
            prisma.platformNotification.count({ where }),
        ]);
        return { data: raws.map(r => this.platformMapper.toDomain(r)), meta: buildPaginationMeta(total, page, limit) };
    }

    async findPlatformNotificationById(id: string): Promise<PlatformNotificationEntity | null> {
        const raw = await prisma.platformNotification.findUnique({ where: { id } });
        return raw ? this.platformMapper.toDomain(raw) : null;
    }

    // ── School notifications (tenant schema) ──────────────────────────────
    async createSchoolNotification(data: Prisma.SchoolNotificationUncheckedCreateInput): Promise<SchoolNotificationEntity> {
        return this.schoolMapper.toDomain(await this.tenantDb.schoolNotification.create({ data }));
    }

    async paginateSchoolNotifications(params: PaginateParams): Promise<PaginatedResult<SchoolNotificationEntity>> {
        const { page, limit, skip } = parsePagination({ page: params.page, limit: params.limit });
        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };
        const [raws, total] = await Promise.all([
            this.tenantDb.schoolNotification.findMany({ where, skip, take: limit, orderBy }),
            this.tenantDb.schoolNotification.count({ where }),
        ]);
        return { data: raws.map(r => this.schoolMapper.toDomain(r)), meta: buildPaginationMeta(total, page, limit) };
    }

    async findSchoolNotificationById(id: string): Promise<SchoolNotificationEntity | null> {
        const raw = await this.tenantDb.schoolNotification.findUnique({ where: { id } });
        return raw ? this.schoolMapper.toDomain(raw) : null;
    }

    // ── School notification recipients ────────────────────────────────────
    async createSchoolRecipientsBatch(rows: Prisma.SchoolNotificationRecipientCreateManyInput[]): Promise<number> {
        let inserted = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
            const res = await this.tenantDb.schoolNotificationRecipient.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
            inserted += res.count;
        }
        return inserted;
    }

    async findExistingIdempotencyKeys(keys: string[]): Promise<Set<string>> {
        const found = new Set<string>();
        for (let i = 0; i < keys.length; i += CHUNK) {
            const rows = await this.tenantDb.schoolNotificationRecipient.findMany({
                where: { idempotencyKey: { in: keys.slice(i, i + CHUNK) } }, select: { idempotencyKey: true },
            });
            for (const r of rows) if (r.idempotencyKey) found.add(r.idempotencyKey);
        }
        return found;
    }

    async findSchoolRecipientById(id: string): Promise<SchoolNotificationRecipientEntity | null> {
        const raw = await this.tenantDb.schoolNotificationRecipient.findUnique({ where: { id } });
        return raw as unknown as SchoolNotificationRecipientEntity | null;
    }

    async findUnqueuedDeliverables(notificationId: string): Promise<DeliverableRef[]> {
        const rows = await this.tenantDb.schoolNotificationRecipient.findMany({
            where: { notificationId, status: "PENDING", channel: { in: ["EMAIL", "SMS"] } }, select: { id: true, channel: true },
        });
        return rows as unknown as DeliverableRef[];
    }

    async findStaleDeliverables(olderThan: Date, limit: number): Promise<DeliverableRef[]> {
        const rows = await this.tenantDb.schoolNotificationRecipient.findMany({
            where: { status: { in: ["PENDING", "QUEUED"] }, channel: { in: ["EMAIL", "SMS"] }, updatedAt: { lt: olderThan } },
            select: { id: true, channel: true }, orderBy: { createdAt: "asc" }, take: limit,
        });
        return rows as unknown as DeliverableRef[];
    }

    async markSchoolRecipientsQueued(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.tenantDb.schoolNotificationRecipient.updateMany({
            where: { id: { in: ids }, status: { in: ["PENDING", "QUEUED"] } }, data: { status: "QUEUED", queuedAt: new Date() },
        });
    }

    async markSchoolRecipientSent(id: string, providerMsgId?: string): Promise<void> {
        await this.tenantDb.schoolNotificationRecipient.update({
            where: { id }, data: { status: "SENT", sentAt: new Date(), failedReason: null, ...(providerMsgId && { providerMsgId }) },
        });
    }

    async markSchoolRecipientFailed(id: string, reason: string): Promise<void> {
        await this.tenantDb.schoolNotificationRecipient.update({
            where: { id }, data: { status: "FAILED", failedAt: new Date(), failedReason: reason.slice(0, 500), retryCount: { increment: 1 } },
        });
    }

    async findMySchoolNotifications(owner: RecipientOwner, params: PaginateParams): Promise<PaginatedResult<any>> {
        const { page, limit, skip } = parsePagination({ page: params.page, limit: params.limit });
        const where = { ...(params.where ?? {}), recipientType: owner.recipientType, recipientEntityId: owner.recipientEntityId, channel: "IN_APP" as const };
        const [raws, total] = await Promise.all([
            this.tenantDb.schoolNotificationRecipient.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { notification: true } }),
            this.tenantDb.schoolNotificationRecipient.count({ where }),
        ]);
        return { data: raws, meta: buildPaginationMeta(total, page, limit) };
    }

    async markSchoolRecipientRead(recipientId: string, owner: RecipientOwner): Promise<boolean> {
        const res = await this.tenantDb.schoolNotificationRecipient.updateMany({
            where: { id: recipientId, recipientType: owner.recipientType, recipientEntityId: owner.recipientEntityId, channel: "IN_APP" },
            data:  { readAt: new Date(), status: "READ" },
        });
        return res.count > 0;
    }

    async markAllSchoolRecipientsRead(owner: RecipientOwner): Promise<number> {
        const res = await this.tenantDb.schoolNotificationRecipient.updateMany({
            where: { recipientType: owner.recipientType, recipientEntityId: owner.recipientEntityId, channel: "IN_APP", readAt: null },
            data:  { readAt: new Date(), status: "READ" },
        });
        return res.count;
    }

    // ── Platform notification recipients (public schema) ──────────────────
    async createPlatformRecipient(data: publicPrisma.PlatformNotificationRecipientUncheckedCreateInput): Promise<PlatformNotificationRecipientEntity> {
        return (await prisma.platformNotificationRecipient.create({ data })) as unknown as PlatformNotificationRecipientEntity;
    }

    async findPlatformRecipientById(id: string): Promise<PlatformNotificationRecipientEntity | null> {
        return (await prisma.platformNotificationRecipient.findUnique({ where: { id } })) as unknown as PlatformNotificationRecipientEntity | null;
    }

    async findMyPlatformNotifications(schoolId: string, params: PaginateParams): Promise<PaginatedResult<any>> {
        const { page, limit, skip } = parsePagination({ page: params.page, limit: params.limit });
        const where = { schoolId, channel: "IN_APP" as const };
        const [raws, total] = await Promise.all([
            prisma.platformNotificationRecipient.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { notification: true } }),
            prisma.platformNotificationRecipient.count({ where }),
        ]);
        return { data: raws, meta: buildPaginationMeta(total, page, limit) };
    }

    async markPlatformRecipientSent(id: string, providerMsgId?: string): Promise<void> {
        await prisma.platformNotificationRecipient.update({
            where: { id }, data: { status: "SENT", sentAt: new Date(), deliveredAt: new Date(), ...(providerMsgId && { providerMsgId }) },
        });
    }

    async markPlatformRecipientFailed(id: string, reason: string): Promise<void> {
        await prisma.platformNotificationRecipient.update({
            where: { id }, data: { status: "FAILED", failedAt: new Date(), failedReason: reason.slice(0, 500), retryCount: { increment: 1 } },
        });
    }

    async findSchoolAdminContact(schoolId: string) {
        const user = await prisma.user.findFirst({
            where: { schoolId, role: "school_admin", isActive: true }, orderBy: { createdAt: "asc" },
            select: { email: true, phone: true, firstName: true },
        });
        return user ? { email: user.email, phone: user.phone ?? null, firstName: user.firstName ?? null } : null;
    }

    async markPlatformRecipientRead(recipientId: string, schoolId: string): Promise<boolean> {
        const res = await prisma.platformNotificationRecipient.updateMany({
            where: { id: recipientId, schoolId }, data: { readAt: new Date(), status: "READ" },
        });
        return res.count > 0;
    }
}
