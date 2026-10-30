import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { StaffMapper } from "../mappers/staff.mapper";
import { StaffEntity } from "../domain/staff.entity";
import { IStaffRepository } from "./staff.repository";

// Loads a staff member's branches with their names in the same query (no extra round trips)
export const WITH_BRANCHES = { branches: { include: { branch: { select: { id: true, name: true, code: true } } }, orderBy: { isPrimary: "desc" } } } as const;

export class StaffRepositoryImpl extends BaseTenantRepository<StaffEntity> implements IStaffRepository {
    protected readonly modelName = "staff";
    protected readonly softDelete = true;           // a staff record is never erased: classes, payroll and history point at it

    constructor({ staffMapper }: { staffMapper: StaffMapper }) { super(staffMapper); }

    async findByUserId(userId: string): Promise<StaffEntity | null> { return this.findOne({ userId }); }
    async findByEmployeeId(employeeId: string): Promise<StaffEntity | null> { return this.findOne({ employeeId }); }
    // Emails are compared ignoring case
    async findByEmail(email: string): Promise<StaffEntity | null> { return this.findOne({ email: { equals: email, mode: "insensitive" } }); }
    async findWithBranches(id: string): Promise<StaffEntity | null> { return this.findById(id, WITH_BRANCHES as never); }
}
