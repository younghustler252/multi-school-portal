import { Prisma } from "../../../generated/prisma";
import { getTenantClient }      from "../../../infrastructure/database/prisma/prisma.client";
import {
    FeeTypeMapper,
    FeeInvoiceMapper,
}                               from "../mappers/fee.mapper";
import {
    FeeTypeEntity,
    FeeInvoiceEntity,
}                               from "../domain/fee.entity";
import { IFeeRepository }       from "./fee.repository";
import {
    PaginateParams,
    PaginatedResult,
}                               from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                               from "../../../shared/utils/pagination";



export class FeeRepositoryImpl implements IFeeRepository {
    private readonly feeTypeMapper:    FeeTypeMapper;
    private readonly feeInvoiceMapper: FeeInvoiceMapper;

    private get db() { return getTenantClient(); }

    constructor({
        feeTypeMapper,
        feeInvoiceMapper,
    }: {
        feeTypeMapper:    FeeTypeMapper;
        feeInvoiceMapper: FeeInvoiceMapper;
    }) {
        this.feeTypeMapper    = feeTypeMapper;
        this.feeInvoiceMapper = feeInvoiceMapper;
    }

    // ── Fee Types ─────────────────────────────────────────────────────────
    async findFeeTypeById(id: string): Promise<FeeTypeEntity | null> {
        const raw = await this.db.feeType.findUnique({ where: { id } });
        return raw ? this.feeTypeMapper.toDomain(raw) : null;
    }

    async findFeeTypeByName(name: string): Promise<FeeTypeEntity | null> {
        const raw = await this.db.feeType.findFirst({ where: { name } });
        return raw ? this.feeTypeMapper.toDomain(raw) : null;
    }

    async findAllFeeTypes(): Promise<FeeTypeEntity[]> {
        const raws = await this.db.feeType.findMany({
            orderBy: { name: "asc" },
        });
        return raws.map(r => this.feeTypeMapper.toDomain(r));
    }

    async createFeeType(data: Prisma.FeeTypeUncheckedCreateInput): Promise<FeeTypeEntity> {
        const raw = await this.db.feeType.create({ data });
        return this.feeTypeMapper.toDomain(raw);
    }

    async updateFeeType(
        id:   string,
        data: Record<string, any>,
    ): Promise<FeeTypeEntity> {
        const raw = await this.db.feeType.update({ where: { id }, data });
        return this.feeTypeMapper.toDomain(raw);
    }

    async deleteFeeType(id: string): Promise<void> {
        await this.db.feeType.delete({ where: { id } });
    }

    // ── Invoices ──────────────────────────────────────────────────────────
    async findInvoiceById(id: string): Promise<FeeInvoiceEntity | null> {
        const raw = await this.db.feeInvoice.findUnique({ where: { id } });
        return raw ? this.feeInvoiceMapper.toDomain(raw) : null;
    }

    async findInvoice(
        where: Record<string, any>,
    ): Promise<FeeInvoiceEntity | null> {
        const raw = await this.db.feeInvoice.findFirst({ where });
        return raw ? this.feeInvoiceMapper.toDomain(raw) : null;
    }

    async paginateInvoices(
        params: PaginateParams,
    ): Promise<PaginatedResult<FeeInvoiceEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.feeInvoice.findMany({ where, skip, take: limit, orderBy }),
            this.db.feeInvoice.count({ where }),
        ]);

        return {
            data: raws.map(r => this.feeInvoiceMapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async createInvoice(
        data: Prisma.FeeInvoiceUncheckedCreateInput,
    ): Promise<FeeInvoiceEntity> {
        const raw = await this.db.feeInvoice.create({ data });
        return this.feeInvoiceMapper.toDomain(raw);
    }

    async updateInvoice(
        id:   string,
        data: Record<string, any>,
    ): Promise<FeeInvoiceEntity> {
        const raw = await this.db.feeInvoice.update({ where: { id }, data });
        return this.feeInvoiceMapper.toDomain(raw);
    }

    async findDefaultersByTerm(
        termId: string,
    ): Promise<FeeInvoiceEntity[]> {
        const raws = await this.db.feeInvoice.findMany({
            where: {
                termId,
                status: { in: ["unpaid", "partial"] },
            },
            orderBy: { amountKobo: "desc" },
        });
        return raws.map(r => this.feeInvoiceMapper.toDomain(r));
    }

    async countInvoices(where: Record<string, any>): Promise<number> {
        return this.db.feeInvoice.count({ where });
    }
}