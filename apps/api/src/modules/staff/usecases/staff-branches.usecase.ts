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
        const staff = await d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        const current = (staff.branches ?? []).map(b => b.id);
        assertCanActOnStaff(actor.access, "staff.manage", staff.id, current);

        const requested = [...new Set(dto.branchIds)];
        const scope = actor.access.branchScope("staff.manage");
        if (Array.isArray(scope) && requested.some(b => !scope.includes(b))) throw staffErrors.branchOutOfScope();
        if ((await d.staffRepository.countActiveBranches(requested)) !== requested.length) throw staffErrors.branchesInvalid();

        // Branches outside the manager's reach are not theirs to remove
        const kept = Array.isArray(scope) ? current.filter(b => !scope.includes(b)) : [];
        const finalIds = [...new Set([...requested, ...kept])];
        const primary = dto.primaryBranchId && finalIds.includes(dto.primaryBranchId) ? dto.primaryBranchId : finalIds[0];

        await d.staffRepository.replaceBranches(id, finalIds, primary, actor.userId);

        const membership = await d.membershipService.findByEntity("STAFF", id);
        if (membership) d.accessService.invalidate(membership.id);

        await d.auditService.log({
            userId: actor.userId, schoolId, action: "staff.branches_changed", entity: "Staff", entityId: id,
            oldValue: { branchIds: current }, newValue: { branchIds: finalIds, primaryBranchId: primary },
        });
        return { staffId: id, branchIds: finalIds, primaryBranchId: primary };
    }
}

/*
| GET /staff/assignable-branches: the branches the signed-in person may place a staff member in (the branch picker).
| Guarded by staff.manage, NOT branches.view, so a person who manages staff can fill the picker without being given the
| wider right to browse branches. It uses the same scope as SetStaffBranchesUseCase and the "new staff" checks
| (branchScope("staff.manage")):
|  - ALL scope    every active branch
|  - BRANCH scope only the active branches among THEIR OWN
|  - anything else nothing (staff.manage cannot be held any other way; this just fails closed)
| Inactive and deleted branches are never listed (they could not be assigned anyway). A branch outside the person's reach is
| not listed, and nothing but what a picker needs is returned. It answers for the person, not for a particular staff member:
| "who may I act on" and "branches the person already has outside my reach are kept" still apply on PUT /staff/:id/branches.
*/
export class ListAssignableBranchesUseCase {
    constructor(private readonly d: Pick<Dependencies, "staffRepository">) {}

    async execute(actor: StaffActor) {
        const scope = actor.access.branchScope("staff.manage");
        let rows: Awaited<ReturnType<IStaffRepository["listActiveBranches"]>> = [];
        if (scope === "ALL") rows = await this.d.staffRepository.listActiveBranches();
        else if (Array.isArray(scope) && scope.length > 0) rows = await this.d.staffRepository.listActiveBranches(scope);
        return rows.map(b => ({ id: b.id, name: b.name, code: b.code, isMain: b.isMain }));
    }
}
