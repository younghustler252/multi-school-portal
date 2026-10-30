import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import type { AccessService } from "../../../foundation/access.service";
import { IStaffRepository } from "../repositories/staff.repository";
import { MembershipService } from "../../auth/services/membership.service";
import { assertCanActOnStaff } from "../services/staff-scope";
import { staffErrors } from "../domain/staff.errors";
import { StaffActor } from "../domain/staff.types";
import { SetStaffBranchesDtoType } from "../dtos/staff.dto";

interface Dependencies {
    staffRepository: IStaffRepository; membershipService: MembershipService; accessService: AccessService; auditService: AuditService;
}

/*
| SET A STAFF MEMBER'S BRANCHES (replaces the set). This one table (StaffBranch) answers two questions:
| where does this person work, and (through BRANCH-scoped roles) where may their login act.
|  - everyone with the ALL scope may set any active branches
|  - a branch-limited manager may only add or remove THEIR OWN branches; the person's branches outside the
|    manager's reach are kept as they are
|  - at least one branch is always kept; the first (or `primaryBranchId`) is the primary one
|  - the person's cached access is dropped so the change applies at once
*/
export class SetStaffBranchesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: SetStaffBranchesDtoType, actor: StaffActor) {
        const d = this.d;
        const db = getTenantClient();
        const staff = await d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        const current = (staff.branches ?? []).map(b => b.id);
        assertCanActOnStaff(actor.access, "staff.manage", staff.id, current);

        const requested = [...new Set(dto.branchIds)];
        const scope = actor.access.branchScope("staff.manage");
        if (Array.isArray(scope) && requested.some(b => !scope.includes(b))) throw staffErrors.branchOutOfScope();
        if ((await db.branch.count({ where: { id: { in: requested }, isActive: true, deletedAt: null } })) !== requested.length) throw staffErrors.branchesInvalid();

        // Branches outside the manager's reach are not theirs to remove
        const kept = Array.isArray(scope) ? current.filter(b => !scope.includes(b)) : [];
        const finalIds = [...new Set([...requested, ...kept])];
        const primary = dto.primaryBranchId && finalIds.includes(dto.primaryBranchId) ? dto.primaryBranchId : finalIds[0];

        await db.$transaction([
            db.staffBranch.deleteMany({ where: { staffId: id } }),
            db.staffBranch.createMany({ data: finalIds.map(branchId => ({ staffId: id, branchId, isPrimary: branchId === primary, assignedById: actor.userId })) }),
        ]);

        const membership = await d.membershipService.findByEntity("STAFF", id);
        if (membership) d.accessService.invalidate(membership.id);

        await d.auditService.log({
            userId: actor.userId, schoolId, action: "staff.branches_changed", entity: "Staff", entityId: id,
            oldValue: { branchIds: current }, newValue: { branchIds: finalIds, primaryBranchId: primary },
        });
        return { staffId: id, branchIds: finalIds, primaryBranchId: primary };
    }
}
