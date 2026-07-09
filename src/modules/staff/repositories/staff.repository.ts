import { StaffEntity }       from "../domain/staff.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| STAFF REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IStaffRepository {
    findById(id: string):                           Promise<StaffEntity | null>;
    findOne(where: Record<string, any>):            Promise<StaffEntity | null>;
    findMany(where?: Record<string, any>):          Promise<StaffEntity[]>;
    paginate(params: PaginateParams):               Promise<PaginatedResult<StaffEntity>>;
    create(data: Record<string, any>):              Promise<StaffEntity>;
    update(id: string, data: Record<string, any>):  Promise<StaffEntity>;
    exists(where: Record<string, any>):             Promise<boolean>;
    count(where?: Record<string, any>):             Promise<number>;

    // ── Staff specific ────────────────────────────────────────────────────
    findByUserId(userId: string):                   Promise<StaffEntity | null>;
    findByEmployeeId(employeeId: string):           Promise<StaffEntity | null>;
    findWithUser(id: string):                       Promise<StaffEntity | null>;
    paginateWithUser(params: PaginateParams):       Promise<PaginatedResult<StaffEntity>>;
}