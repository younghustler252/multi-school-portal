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

/*
|--------------------------------------------------------------------------
| BASE REPOSITORY
| NEW: SOFT DELETE. A repository whose table has a `deletedAt` column sets
|        protected readonly softDelete = true;
| and then, automatically:
|   - every read (findById, findOne, findMany, paginate, count, exists) hides deleted rows
|   - delete(id) does NOT erase the row: it sets deletedAt (history and links stay intact)
|   - restore(id) brings it back; hardDelete(id) really erases (rarely correct; avoid)
| Repositories that do not set it behave exactly as before.
| Caveat: upsert() and the `where` of update() are not filtered (they address a row by key on purpose).
|--------------------------------------------------------------------------
*/
abstract class AbstractBaseRepository<T, DM = any> {
    protected readonly mapper: IMapper<DM, T>;
    protected abstract readonly modelName: string;
    protected readonly softDelete: boolean = false;

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

    // Adds "not deleted" to a filter when this repository uses soft delete
    protected live(where: Record<string, any> = {}): Record<string, any> {
        return this.softDelete ? { ...where, deletedAt: null } : where;
    }

    async findById(id: string, include?: Record<string, any>): Promise<T | null> {
        const raw = this.softDelete
            ? await this.model().findFirst({ where: { id, deletedAt: null }, ...(include && { include }) })
            : await this.model().findUnique({ where: { id }, ...(include && { include }) });
        return this.mapOne(raw);
    }

    async findOne(where: Record<string, any>, include?: Record<string, any>): Promise<T | null> {
        const raw = await this.model().findFirst({
            where: this.live(where),
            ...(include && { include }),
        });
        return this.mapOne(raw);
    }

    async findMany(where: Record<string, any> = {}, include?: Record<string, any>, orderBy?: Record<string, any>): Promise<T[]> {
        const raws = await this.model().findMany({
            where: this.live(where),
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

        const where   = this.live(params.where ?? {});
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

    /** Soft-delete repositories only mark the row as deleted; others erase it as before. */
    async delete(id: string): Promise<T> {
        const raw = this.softDelete
            ? await this.model().update({ where: { id }, data: { deletedAt: new Date() } })
            : await this.model().delete({ where: { id } });
        return this.mapper.toDomain(raw);
    }

    /** Brings a soft-deleted row back. Only for soft-delete repositories. */
    async restore(id: string): Promise<T> {
        if (!this.softDelete) throw new Error(`${this.modelName}: restore() needs softDelete = true`);
        const raw = await this.model().update({ where: { id }, data: { deletedAt: null } });
        return this.mapper.toDomain(raw);
    }

    /** Really erases the row. Almost never what you want: prefer delete(). */
    async hardDelete(id: string): Promise<T> {
        const raw = await this.model().delete({ where: { id } });
        return this.mapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.model().count({ where: this.live(where) });
        return count > 0;
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        return this.model().count({ where: this.live(where) });
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
