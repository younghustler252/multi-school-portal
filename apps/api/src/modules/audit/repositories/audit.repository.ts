import { AuditLogEntity }    from "../domain/audit.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

export interface IAuditRepository {
    create(data: Record<string, any>):              Promise<AuditLogEntity>;
    /** Inserts rows that carry their own id; rows whose id already exists are skipped (so redelivery never duplicates). Returns how many were new. */
    createManyIdempotent(rows: Record<string, any>[]): Promise<number>;
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