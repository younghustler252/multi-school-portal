import { IAuditRepository } from "../repositories/audit.repository";
import { AuditLogEnricherService } from "../services/audit-log-enricher.service";
import { ListPlatformAuditQueryType, ListSchoolAuditQueryType } from "../dtos/audit.dto";

interface Dependencies { auditRepository: IAuditRepository; auditLogEnricherService: AuditLogEnricherService }

type Filters = Omit<ListSchoolAuditQueryType, "page" | "limit">;

// What the person asked to see. An action ending in "." is a family ("staff." = every staff action).
function buildWhere(f: Filters): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (f.userId)   where.userId = f.userId;
    if (f.module)   where.module = f.module;
    if (f.entity)   where.entity = f.entity;
    if (f.entityId) where.entityId = f.entityId;
    if (f.action)   where.action = f.action.endsWith(".") ? { startsWith: f.action } : f.action;
    if (f.startDate || f.endDate) {
        where.createdAt = { ...(f.startDate ? { gte: new Date(f.startDate) } : {}), ...(f.endDate ? { lte: new Date(f.endDate) } : {}) };
    }
    return where;
}

/*
| PLATFORM realm (permission platform.audit.view): the whole platform, or one school with ?schoolId=.
| The old version accepted filters in the request but ignored every one of them.
*/
export class ListPlatformAuditLogsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: ListPlatformAuditQueryType) {
        const { page, limit, schoolId, ...filters } = q;
        const where = buildWhere(filters);
        if (schoolId) where.schoolId = schoolId;
        const r = await this.d.auditRepository.paginate({ page, limit, where, orderBy: { createdAt: "desc" } });
        return { data: await this.d.auditLogEnricherService.enrich(r.data), meta: r.meta };
    }
}

/*
| SCHOOL realm (permission audit.view): ONLY this school's own activity. The school is the host's school, so
| nobody can ask for another school's entries. Add entity=Staff&entityId=... to see the history of one record.
*/
export class ListSchoolAuditLogsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, q: ListSchoolAuditQueryType) {
        const { page, limit, ...filters } = q;
        const r = await this.d.auditRepository.paginate({ page, limit, where: { ...buildWhere(filters), schoolId }, orderBy: { createdAt: "desc" } });
        return { data: await this.d.auditLogEnricherService.enrich(r.data), meta: r.meta };
    }
}
