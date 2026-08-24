import { Prisma } from "../../../generated/tenant";
import { Prisma as publicPrisma } from "../../../generated/public";
import { prisma }                     from "../../../infrastructure/database/prisma/prisma.client";
import { getTenantClient }            from "../../../infrastructure/database/prisma/prisma.client";
import {
    PlatformNotificationMapper,
    SchoolNotificationMapper,
}                                     from "../mappers/notification.mapper";
import {
    PlatformNotificationEntity,
    PlatformNotificationRecipientEntity,
    SchoolNotificationEntity,
}                                     from "../domain/notification.entity";
import { INotificationRepository }    from "./notification.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                     from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                     from "../../../shared/utils/pagination";

export class NotificationRepositoryImpl implements INotificationRepository {
    private readonly platformMapper: PlatformNotificationMapper;
    private readonly schoolMapper:   SchoolNotificationMapper;

    private get tenantDb() { return getTenantClient(); }

    constructor({
        platformNotificationMapper,
        schoolNotificationMapper,
    }: {
        platformNotificationMapper: PlatformNotificationMapper;
        schoolNotificationMapper:   SchoolNotificationMapper;
    }) {
        this.platformMapper = platformNotificationMapper;
        this.schoolMapper   = schoolNotificationMapper;
    }

    // ── Platform notifications (public schema) ────────────────────────────
    async createPlatformNotification(
        data: publicPrisma.PlatformNotificationUncheckedCreateInput,
    ): Promise<PlatformNotificationEntity> {
        const raw = await prisma.platformNotification.create({ data });
        return this.platformMapper.toDomain(raw);
    }

    async updatePlatformNotification(
        id:   string,
        data: Record<string, any>,
    ): Promise<PlatformNotificationEntity> {
        const raw = await prisma.platformNotification.update({
            where: { id },
            data,
        });
        return this.platformMapper.toDomain(raw);
    }

    async paginatePlatformNotifications(
        params: PaginateParams,
    ): Promise<PaginatedResult<PlatformNotificationEntity>> {
        const { page, limit, skip } = parsePagination({
            page: params.page, limit: params.limit,
        });
        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            prisma.platformNotification.findMany({
                where, skip, take: limit, orderBy,
            }),
            prisma.platformNotification.count({ where }),
        ]);

        return {
            data: raws.map(r => this.platformMapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async findPlatformNotificationById(
        id: string,
    ): Promise<PlatformNotificationEntity | null> {
        const raw = await prisma.platformNotification.findUnique({
            where: { id },
        });
        return raw ? this.platformMapper.toDomain(raw) : null;
    }

    // ── School notifications (tenant schema) ──────────────────────────────
    async createSchoolNotification(
        data: Prisma.SchoolNotificationUncheckedCreateInput,
    ): Promise<SchoolNotificationEntity> {
        const raw = await this.tenantDb.schoolNotification.create({ data });
        return this.schoolMapper.toDomain(raw);
    }

    async paginateSchoolNotifications(
        params: PaginateParams,
    ): Promise<PaginatedResult<SchoolNotificationEntity>> {
        const { page, limit, skip } = parsePagination({
            page: params.page, limit: params.limit,
        });
        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.tenantDb.schoolNotification.findMany({
                where, skip, take: limit, orderBy,
            }),
            this.tenantDb.schoolNotification.count({ where }),
        ]);

        return {
            data: raws.map(r => this.schoolMapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async createRecipient(data: Prisma.SchoolNotificationRecipientUncheckedCreateInput): Promise<void> {
        await this.tenantDb.schoolNotificationRecipient.create({ data });
    }

    async createPlatformRecipient(
        data: publicPrisma.PlatformNotificationRecipientUncheckedCreateInput,
    ): Promise<PlatformNotificationRecipientEntity> {
        const raw = await prisma.platformNotificationRecipient.create({ data });
        return raw as unknown as PlatformNotificationRecipientEntity;
    }

    async markPlatformRecipientSent(id: string): Promise<void> {
        await prisma.platformNotificationRecipient.update({
            where: { id },
            data:  { status: "SENT", deliveredAt: new Date() },
        });
    }

    async markPlatformRecipientFailed(id: string, reason: string): Promise<void> {
        await prisma.platformNotificationRecipient.update({
            where: { id },
            data:  { status: "FAILED", failedReason: reason },
        });
    }
}