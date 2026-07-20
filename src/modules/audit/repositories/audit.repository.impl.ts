import { prisma }                from "../../../infrastructure/database/prisma/prisma.client";
import { Prisma } from "../../../generated/prisma";
import { AuditMapper }           from "../mappers/audit.mapper";
import { AuditLogEntity }        from "../domain/audit.entity";
import { IAuditRepository }      from "./audit.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| AUDIT REPOSITORY
| Uses PUBLIC prisma client — audit logs live in public schema
|--------------------------------------------------------------------------
*/

export class AuditRepositoryImpl implements IAuditRepository {
    private readonly mapper: AuditMapper;

    constructor({ auditMapper }: { auditMapper: AuditMapper }) {
        this.mapper = auditMapper;
    }

    async create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLogEntity> {
        const raw = await prisma.auditLog.create({ data });
        return this.mapper.toDomain(raw);
    }

    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<AuditLogEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            prisma.auditLog.findMany({ where, skip, take: limit, orderBy }),
            prisma.auditLog.count({ where }),
        ]);

        return {
            data: raws.map(r => this.mapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async findBySchool(
        schoolId: string,
        params:   PaginateParams,
    ): Promise<PaginatedResult<AuditLogEntity>> {
        return this.paginate({
            ...params,
            where: { ...params.where, schoolId },
        });
    }

    async findByUser(
        userId: string,
        params: PaginateParams,
    ): Promise<PaginatedResult<AuditLogEntity>> {
        return this.paginate({
            ...params,
            where: { ...params.where, userId },
        });
    }
}