import { StaffEntity } from "../domain/staff.entity";
import { PaginatedResult, PaginateParams } from "../../../infrastructure/repository/base.repository";

export interface IStaffRepository {
    findById(id: string, include?: Record<string, any>): Promise<StaffEntity | null>;
    findOne(where: Record<string, any>, include?: Record<string, any>): Promise<StaffEntity | null>;
    findMany(where?: Record<string, any>, include?: Record<string, any>, orderBy?: Record<string, any>): Promise<StaffEntity[]>;
    paginate(params: PaginateParams): Promise<PaginatedResult<StaffEntity>>;
    create(data: Record<string, any>): Promise<StaffEntity>;
    update(id: string, data: Record<string, any>): Promise<StaffEntity>;
    delete(id: string): Promise<StaffEntity>;                 // soft delete
    exists(where: Record<string, any>): Promise<boolean>;
    count(where?: Record<string, any>): Promise<number>;

    // ── Staff specific ───────────────────────────────────────────────────
    findByUserId(userId: string): Promise<StaffEntity | null>;
    findByEmployeeId(employeeId: string): Promise<StaffEntity | null>;
    findByEmail(email: string): Promise<StaffEntity | null>;
    findWithBranches(id: string): Promise<StaffEntity | null>;
}
