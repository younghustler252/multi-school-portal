import { IAuditRepository }      from "../repositories/audit.repository";
import { AuditMapper }           from "../mappers/audit.mapper";
import { AuditLogResponseData }  from "../mappers/audit.mapper";
import { PaginatedResult }       from "../../../infrastructure/repository/base.repository";
import { ListAuditLogsDtoType }  from "../dtos/audit.dto";

interface Dependencies {
    auditRepository: IAuditRepository;
    auditMapper:     AuditMapper;
}

export class GetAuditLogsUseCase {
    private readonly auditRepository: IAuditRepository;
    private readonly auditMapper:     AuditMapper;

    constructor({ auditRepository, auditMapper }: Dependencies) {
        this.auditRepository = auditRepository;
        this.auditMapper     = auditMapper;
    }

    async execute(
        dto: ListAuditLogsDtoType,
    ): Promise<PaginatedResult<AuditLogResponseData>> {
        const where: Record<string, any> = {};

        if (dto.userId)   where.userId   = dto.userId;
        if (dto.schoolId) where.schoolId = dto.schoolId;
        if (dto.action)   where.action   = { contains: dto.action };
        if (dto.entity)   where.entity   = dto.entity;

        if (dto.startDate && dto.endDate) {
            where.createdAt = {
                gte: new Date(dto.startDate),
                lte: new Date(dto.endDate),
            };
        }

        const result = await this.auditRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 50,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(a => this.auditMapper.toResponse(a)),
            meta: result.meta,
        };
    }
}