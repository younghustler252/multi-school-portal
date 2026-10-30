import { assertWithinPlanLimit } from "../../../infrastructure/middleware/feature-gate.middleware";
import { AuditService } from "../../audit/services/audit.service";
import type { AccessService } from "../../../foundation/access.service";
import { IStaffRepository } from "../repositories/staff.repository";
import { IRefreshTokenRepository } from "../../auth/repositories/refresh-token.repository";
import { MembershipService } from "../../auth/services/membership.service";
import { StaffMapper, StaffResponseData } from "../mappers/staff.mapper";
import { StaffPortalService } from "../services/staff-portal.service";
import { assertCanActOnStaff } from "../services/staff-scope";
import { activeAssignments } from "./update-staff.usecase";
import { staffErrors } from "../domain/staff.errors";
import { StaffActor } from "../domain/staff.types";
import { DeactivateStaffDtoType } from "../dtos/staff.dto";

interface Dependencies {
    staffRepository: IStaffRepository; staffMapper: StaffMapper; staffPortalService: StaffPortalService;
    membershipService: MembershipService; accessService: AccessService; refreshTokenRepository: IRefreshTokenRepository; auditService: AuditService;
}

/*
|--------------------------------------------------------------------------
| DEACTIVATE STAFF (they stop working here; nothing is erased)
| Fixes a serious old bug: the old version switched off the person's whole LOGIN, locking a teacher out of EVERY
| school they work in. Now only THIS school's access is switched off: the staff record is marked inactive, this
| school's membership is suspended, this school's sessions are ended, and any waiting invitation is cancelled.
| Refused when: it is your own record; it is the school's only administrator.
| The response warns how many class/subject assignments still need a new teacher.
|--------------------------------------------------------------------------
*/
export class DeactivateStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: DeactivateStaffDtoType, actor: StaffActor): Promise<{ staff: StaffResponseData; warnings: { activeAssignments: number } }> {
        const d = this.d;
        const staff = await d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        assertCanActOnStaff(actor.access, "staff.manage", staff.id, (staff.branches ?? []).map(b => b.id));
        if (!staff.isActive) throw staffErrors.alreadyInactive();
        if (staff.id === actor.access.personaEntityId || (staff.userId && staff.userId === actor.userId)) throw staffErrors.selfAction("deactivate");

        if (staff.userId) {
            const admins = await d.membershipService.listActiveUserIdsByRoleKey("school_admin");
            if (admins.length === 1 && admins[0] === staff.userId) throw staffErrors.lastAdmin();
        }

        const assignments = await activeAssignments(staff.id);
        await d.staffRepository.update(id, {
            isActive: false, exitDate: dto.exitDate ? new Date(dto.exitDate) : new Date(), exitReason: dto.exitReason ?? null, updatedById: actor.userId,
        });

        const membership = await d.membershipService.findByEntity("STAFF", id);
        if (membership) {
            await d.membershipService.setStatus(membership.id, "suspended");
            await d.refreshTokenRepository.revokeForMembership(membership.id);
            d.accessService.invalidate(membership.id);
        }
        await d.staffPortalService.cancelPendingInvites(schoolId, id);

        await d.auditService.log({
            userId: actor.userId, schoolId, action: "staff.deactivated", entity: "Staff", entityId: id,
            oldValue: { isActive: true }, newValue: { isActive: false, exitReason: dto.exitReason ?? null }, metadata: { activeAssignments: assignments },
        });

        const fresh = (await d.staffRepository.findWithBranches(id))!;
        const portal = await d.staffPortalService.describe(schoolId, [id]);
        return { staff: d.staffMapper.toResponse(fresh, portal.get(id)), warnings: { activeAssignments: assignments } };
    }
}

// REACTIVATE: back to work. Needs room in the plan's staff limit again; this school's access is switched back on.
export class ReactivateStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, actor: StaffActor): Promise<StaffResponseData> {
        const d = this.d;
        const staff = await d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        assertCanActOnStaff(actor.access, "staff.manage", staff.id, (staff.branches ?? []).map(b => b.id));
        if (staff.isActive) throw staffErrors.alreadyActive();

        await assertWithinPlanLimit(schoolId, "staff", 1);
        await d.staffRepository.update(id, { isActive: true, exitDate: null, exitReason: null, updatedById: actor.userId });

        const membership = await d.membershipService.findByEntity("STAFF", id);
        if (membership && membership.status === "suspended") {
            await d.membershipService.setStatus(membership.id, "active");
            d.accessService.invalidate(membership.id);
        }
        await d.auditService.log({ userId: actor.userId, schoolId, action: "staff.reactivated", entity: "Staff", entityId: id, oldValue: { isActive: false }, newValue: { isActive: true } });

        const fresh = (await d.staffRepository.findWithBranches(id))!;
        const portal = await d.staffPortalService.describe(schoolId, [id]);
        return d.staffMapper.toResponse(fresh, portal.get(id));
    }
}
