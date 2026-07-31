import { PrismaClient as PublicPrismaClient } from "../../generated/public";
import { PrismaClient as TenantPrismaClient } from "../../generated/tenant";
import { getTenantClient, prisma as globalPublicPrisma } from "../database/prisma/prisma.client";
import { parsePagination, buildPaginationMeta } from "../../shared/utils/pagination";
import type { PaginationMeta } from "../../shared/utils/api-response";

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

abstract class AbstractBaseRepository<T, DM = any> {
    protected readonly mapper: IMapper<DM, T>;
    protected abstract readonly modelName: string;

    constructor(mapper: IMapper<DM, T>) {
        this.mapper = mapper;
    }

    protected abstract model(): any;

    protected mapOne(raw: DM | null): T | null {
        if (!raw) return null;
        return this.mapper.toDomain(raw);
    }

    protected mapMany(raws: DM[]): T[] {
        if (!Array.isArray(raws)) return [];
        return raws.map(raw => this.mapper.toDomain(raw));
    }

    async findById(id: string, include?: Record<string, any>): Promise<T | null> {
        const raw = await this.model().findUnique({
            where: { id },
            ...(include && { include }),
        });
        return this.mapOne(raw);
    }

    async findOne(where: Record<string, any>, include?: Record<string, any>): Promise<T | null> {
        const raw = await this.model().findFirst({
            where,
            ...(include && { include }),
        });
        return this.mapOne(raw);
    }

    async findMany(where: Record<string, any> = {}, include?: Record<string, any>, orderBy?: Record<string, any>): Promise<T[]> {
        const raws = await this.model().findMany({
            where,
            ...(include && { include }),
            ...(orderBy && { orderBy }),
        });
        return this.mapMany(raws);
    }

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

    async create(data: Record<string, any>, include?: Record<string, any>): Promise<T> {
        const raw = await this.model().create({
            data,
            ...(include && { include }),
        });
        return this.mapper.toDomain(raw);
    }

    async update(id: string, data: Record<string, any>, include?: Record<string, any>): Promise<T> {
        const raw = await this.model().update({
            where: { id },
            data,
            ...(include && { include }),
        });
        return this.mapper.toDomain(raw);
    }

    async delete(id: string): Promise<T> {
        const raw = await this.model().delete({ where: { id } });
        return this.mapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.model().count({ where });
        return count > 0;
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        return this.model().count({ where });
    }

    async upsert(where: Record<string, any>, create: Record<string, any>, update: Record<string, any>): Promise<T> {
        const raw = await this.model().upsert({ where, create, update });
        return this.mapper.toDomain(raw);
    }
}

export abstract class BasePublicRepository<T, DM = any> extends AbstractBaseRepository<T, DM> {
    protected get prisma(): PublicPrismaClient {
        return globalPublicPrisma;
    }

    protected model(): any {
        return (this.prisma as any)[this.modelName];
    }
}

export abstract class BaseTenantRepository<T, DM = any> extends AbstractBaseRepository<T, DM> {
    protected get prisma(): TenantPrismaClient {
        return getTenantClient();
    }

    protected model(): any {
        return (this.prisma as any)[this.modelName];
    }
}