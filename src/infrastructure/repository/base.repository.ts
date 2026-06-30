import { PrismaClient } from "../../generated/prisma/client";
import { PaginationParams }  from "../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| BASE REPOSITORY
| Generic CRUD operations every repository inherits
| T  = Domain entity type
| ID = ID type (default string)
|--------------------------------------------------------------------------
*/

export abstract class BaseRepository<T> {
    protected readonly prisma: PrismaClient;
    protected abstract readonly modelName: string;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    // ── Helpers ─────────────────────────────────────────────────────────
    protected getModel(): any {
        return (this.prisma as any)[this.modelName];
    }

    // ── Find by ID ───────────────────────────────────────────────────────
    async findById(id: string): Promise<T | null> {
        return this.getModel().findUnique({
            where: { id },
        });
    }

    // ── Find all with pagination ─────────────────────────────────────────
    async findAll(
        pagination: PaginationParams,
        where:      Record<string, any> = {},
    ): Promise<{ data: T[]; total: number }> {
        const [data, total] = await Promise.all([
            this.getModel().findMany({
                where,
                skip:  pagination.skip,
                take:  pagination.limit,
                orderBy: { createdAt: "desc" },
            }),
            this.getModel().count({ where }),
        ]);

        return { data, total };
    }

    // ── Create ───────────────────────────────────────────────────────────
    async create(data: Partial<T>): Promise<T> {
        return this.getModel().create({ data });
    }

    // ── Update ───────────────────────────────────────────────────────────
    async update(id: string, data: Partial<T>): Promise<T> {
        return this.getModel().update({
            where: { id },
            data,
        });
    }

    // ── Delete ───────────────────────────────────────────────────────────
    async delete(id: string): Promise<T> {
        return this.getModel().delete({
            where: { id },
        });
    }

    // ── Exists ───────────────────────────────────────────────────────────
    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.getModel().count({ where });
        return count > 0;
    }

    // ── Count ────────────────────────────────────────────────────────────
    async count(where: Record<string, any> = {}): Promise<number> {
        return this.getModel().count({ where });
    }
}