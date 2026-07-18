import { PrismaClient } from "../../generated/prisma/client";
import { getTenantClient, prisma as globalPublicPrisma } from "../database/prisma/prisma.client"; // 1. Pull in both clients
import { TenantContext } from "../database/prisma/tenant.context"; // 2. Pull in the safe context guard
import {
    parsePagination,
    buildPaginationMeta,
}                                   from "../../shared/utils/pagination";
import type { PaginationMeta }      from "../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| BASE REPOSITORY
| Generic Prisma repository — extended by every module repository
| T  = Domain entity type (what the mapper returns)
| DM = Database model type (raw Prisma result)
|--------------------------------------------------------------------------
*/

export interface IMapper<DM, T> {
    toDomain(raw: DM): T;
}

export interface PaginateParams {
    page?:    number;
    limit?:   number;
    where?:   Record<string, any>;
    orderBy?: Record<string, any>;
    include?: Record<string, any>;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: PaginationMeta;
}

export abstract class BaseRepository<T, DM = any> {
    
    // ── THE SAFE MULTI-TENANT CONTEXT GETTER ──────────────────────────────
    protected get prisma(): PrismaClient {
        // Look inside AsyncLocalStorage without crashing if the request is public
        const activeContext = TenantContext.getSafe();

        // If there is no request context active (like during login), or we are 
        // explicitly targeting the public registry, safely use the global public client!
        if (!activeContext || activeContext.tenantSchema === "public") {
            return globalPublicPrisma;
        }

        // Otherwise, dynamically route through your cached tenant pools
        return getTenantClient();
    }
    
    protected readonly mapper:  IMapper<DM, T>;
    protected abstract readonly modelName: string;

    // We keep the constructor input signature exactly the same so your Dependency Container doesn't break!
    constructor(_prisma: PrismaClient, mapper: IMapper<DM, T>) {
        this.mapper = mapper;
    }

    // ── Get Prisma model delegate ────────────────────────────────────────
    protected model(): any {
        // Calls the getter dynamically on every request execution cycle
        return (this.prisma as any)[this.modelName];
    }

    // ── Mapper helpers ───────────────────────────────────────────────────
    protected mapOne(raw: DM | null): T | null {
        if (!raw) return null;
        return this.mapper.toDomain(raw);
    }

    protected mapMany(raws: DM[]): T[] {
        if (!Array.isArray(raws)) return [];
        return raws.map(raw => this.mapper.toDomain(raw));
    }

    // ── Find by ID ───────────────────────────────────────────────────────
    async findById(id: string, include?: Record<string, any>): Promise<T | null> {
        const raw = await this.model().findUnique({
            where: { id },
            ...(include && { include }),
        });
        return this.mapOne(raw);
    }

    // ── Find one ────────────────────────────────────────────────_________
    async findOne(where: Record<string, any>, include?: Record<string, any>): Promise<T | null> {
        const raw = await this.model().findFirst({
            where,
            ...(include && { include }),
        });
        return this.mapOne(raw);
    }

    // ── Find many ────────────────────────────────────────────────────────
    async findMany(where: Record<string, any> = {}, include?: Record<string, any>, orderBy?: Record<string, any>): Promise<T[]> {
        const raws = await this.model().findMany({
            where,
            ...(include && { include }),
            ...(orderBy && { orderBy }),
        });
        return this.mapMany(raws);
    }

    // ── Paginate ─────────────────────────────────────────────────────────
    async paginate(params: PaginateParams): Promise<PaginatedResult<T>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.model().findMany({
                where,
                skip,
                take:    limit,
                orderBy,
                ...(params.include && { include: params.include }),
            }),
            this.model().count({ where }),
        ]);

        return {
            data: this.mapMany(raws),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    // ── Create ───────────────────────────────────────────────────────────
    async create(data: Record<string, any>, include?: Record<string, any>): Promise<T> {
        const raw = await this.model().create({
            data,
            ...(include && { include }),
        });
        return this.mapper.toDomain(raw);
    }

    // ── Update ───────────────────────────────────────────────────────────
    async update(id: string, data: Record<string, any>, include?: Record<string, any>): Promise<T> {
        const raw = await this.model().update({
            where: { id },
            data,
            ...(include && { include }),
        });
        return this.mapper.toDomain(raw);
    }

    // ── Delete ───────────────────────────────────────────────────────────
    async delete(id: string): Promise<T> {
        const raw = await this.model().delete({ where: { id } });
        return this.mapper.toDomain(raw);
    }

    // ── Exists ───────────────────────────────────────────────────────────
    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.model().count({ where });
        return count > 0;
    }

    // ── Count ────────────────────────────────────────────────────────────
    async count(where: Record<string, any> = {}): Promise<number> {
        return this.model().count({ where });
    }

    // ── Upsert ───────────────────────────────────────────────────────────
    async upsert(where: Record<string, any>, create: Record<string, any>, update: Record<string, any>): Promise<T> {
        const raw = await this.model().upsert({ where, create, update });
        return this.mapper.toDomain(raw);
    }
}
