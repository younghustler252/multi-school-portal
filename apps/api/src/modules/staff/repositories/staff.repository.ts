import { StaffEntity } from "../domain/staff.entity";
import { PaginatedResult, PaginateParams } from "../../../infrastructure/repository/base.repository";

export interface ActiveBranchRow { id: string; name: string; code: string; isMain: boolean }

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

    // ── Assignments and branches ─────────────────────────────────────────
    findMainBranchId(): Promise<string | null>;
    /** How many of these branches exist and are active (not deleted). */
    countActiveBranches(ids: string[]): Promise<number>;
    /** The active (not deleted) branches, main first then by name; only these ids when `ids` is given. Feeds the branch picker. */
    listActiveBranches(ids?: string[]): Promise<ActiveBranchRow[]>;
    /** Replaces all of a person's branches in one step. */
    replaceBranches(staffId: string, branchIds: string[], primaryBranchId: string, assignedById: string): Promise<void>;
    /** Creates the staff row and its branches in one transaction. `employeeId` may be worked out inside that transaction. */
    createWithBranches(input: {
        data: Record<string, unknown>; branchIds: string[]; assignedById: string;
        employeeId: string | ((tx: unknown) => Promise<string>);
    }): Promise<{ id: string }>;
}
