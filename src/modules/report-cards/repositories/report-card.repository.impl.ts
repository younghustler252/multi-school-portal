import { getTenantClient }         from "../../../infrastructure/database/prisma/prisma.client";
import { ReportCardMapper }        from "../mappers/report-card.mapper";
import { ReportCardEntity }        from "../domain/report-card.entity";
import { IReportCardRepository }   from "./report-card.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                  from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                  from "../../../shared/utils/pagination";
import { Prisma } from "../../../generated/prisma";

export class ReportCardRepositoryImpl implements IReportCardRepository {
    private readonly mapper: ReportCardMapper;

    private get db() { return getTenantClient(); }

    constructor({ reportCardMapper }: { reportCardMapper: ReportCardMapper }) {
        this.mapper = reportCardMapper;
    }

    async findById(id: string): Promise<ReportCardEntity | null> {
        const raw = await this.db.reportCard.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findOne(where: Record<string, any>): Promise<ReportCardEntity | null> {
        const raw = await this.db.reportCard.findFirst({ where });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async findMany(where: Record<string, any> = {}): Promise<ReportCardEntity[]> {
        const raws = await this.db.reportCard.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return raws.map(r => this.mapper.toDomain(r));
    }

    async paginate(params: PaginateParams): Promise<PaginatedResult<ReportCardEntity>> {
        const { page, limit, skip } = parsePagination({
            page: params.page, limit: params.limit,
        });
        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.reportCard.findMany({ where, skip, take: limit, orderBy }),
            this.db.reportCard.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async create(data: Prisma.ReportCardUncheckedCreateInput): Promise<ReportCardEntity> {
        const raw = await this.db.reportCard.create({ data });
        return this.mapper.toDomain(raw);
    }

    async update(id: string, data: Record<string, any>): Promise<ReportCardEntity> {
        const raw = await this.db.reportCard.update({ where: { id }, data });
        return this.mapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.db.reportCard.count({ where });
        return count > 0;
    }

    async findByStudentAndTerm(
        studentId: string,
        termId:    string,
    ): Promise<ReportCardEntity | null> {
        return this.findOne({ studentId, termId });
    }

    async findByTerm(termId: string): Promise<ReportCardEntity[]> {
        return this.findMany({ termId });
    }

    async publishAll(termId: string): Promise<number> {
        const result = await this.db.reportCard.updateMany({
            where: { termId, status: { not: "published" } },
            data:  { status: "published" },
        });
        return result.count;
    }
}