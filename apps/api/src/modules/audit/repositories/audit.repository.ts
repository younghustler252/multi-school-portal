import { AuditLogEntity }    from "../domain/audit.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

export interface IAuditRepository {
    create(data: Record<string, any>):              Promise<AuditLogEntity>;
    paginate(params: PaginateParams):               Promise<PaginatedResult<AuditLogEntity>>;
    findBySchool(
        schoolId: string,
        params:   PaginateParams,
    ):                                              Promise<PaginatedResult<AuditLogEntity>>;
    findByUser(
        userId: string,
        params: PaginateParams,
    ):                                              Promise<PaginatedResult<AuditLogEntity>>;
}