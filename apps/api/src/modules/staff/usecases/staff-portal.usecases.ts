import { AuditService } from "../../audit/services/audit.service";
import { canGrantRole } from "../../../foundation/access.service";
import type { AccessService } from "../../../foundation/access.service";
import { IStaffRepository } from "../repositories/staff.repository";
import { MembershipService } from "../../auth/services/membership.service";
import { SendInviteUseCase } from "../../auth/usecases/send-invite.usecase";
import { StaffPortalService } from "../services/staff-portal.service";
import { assertCanActOnStaff } from "../services/staff-scope";
import { staffErrors } from "../domain/staff.errors";
import { StaffActor } from "../domain/staff.types";
import { InviteStaffDtoType, ChangeStaffRolesDtoType } from "../dtos/staff.dto";

interface Dependencies {
    staffRepository: IStaffRepository; membershipService: MembershipService; accessService: AccessService;
    sendInviteUseCase: SendInviteUseCase; auditService: AuditService;
}

/*
| INVITE A STAFF MEMBER TO THE PORTAL. The person chooses their own password (no passwords are ever emailed).
| This reuses the auth invitation engine, so every auth rule applies unchanged: the invitation goes to the staff
| member's own email, an invitation can only grant a role the inviter could grant themselves, it expires, and it
| can be used once. When it is accepted the new login is linked to THIS staff record.
*/
export class InviteStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: InviteStaffDtoType, actor: StaffActor) {
        const d = this.d;
        const staff = await d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        assertCanActOnStaff(actor.access, "staff.manage", staff.id, (staff.branches ?? []).map(b => b.id));
        if (!staff.isActive) throw staffErrors.inactive();
        if (!staff.email) throw staffErrors.noEmail();
        if (await d.membershipService.findByEntity("STAFF", id)) throw staffErrors.alreadyHasAccess();

        return d.sendInviteUseCase.execute(
            { email: staff.email, persona: "STAFF", roleId: dto.roleId, personaEntityId: id, firstName: staff.firstName },
            schoolId,
            { userId: actor.userId, membershipId: actor.membershipId, isAdmin: actor.isAdmin, can: (k: string) => actor.access.can(k), scopeOf: (k: string) => actor.access.scopeOf(k) },
            { ip: actor.ip, userAgent: actor.userAgent },
        );
    }
}

/*
| CHANGE A STAFF MEMBER'S ROLES (replaces them). Rules:
|  - the person must already have portal access (invited and accepted)
|  - you cannot change your OWN role (nobody promotes themselves, nobody locks themselves out)
|  - you can only grant roles whose every permission you hold yourself; a grants-all role only by a School Admin
|  - the school's only administrator cannot lose the administrator role
|  - the change applies at once (cached access is dropped)
*/
export class ChangeStaffRolesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: ChangeStaffRolesDtoType, actor: StaffActor) {
        const d = this.d;
        const staff = await d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        assertCanActOnStaff(actor.access, "staff.manage", staff.id, (staff.branches ?? []).map(b => b.id));

        const membership = await d.membershipService.findByEntity("STAFF", id);
        if (!membership) throw staffErrors.notPortalUser();
        if (membership.userId === actor.userId) throw staffErrors.ownRole();

        const ids = [...new Set(dto.roleIds)];
        const roles = await Promise.all(ids.map(r => d.membershipService.getRole(r)));
        if (roles.some(r => !r || r.persona !== "STAFF")) throw staffErrors.rolesInvalid();

        for (const role of roles) {
            if (!canGrantRole(role!, { isAdmin: actor.isAdmin, scopeOf: k => actor.access.scopeOf(k) })) throw staffErrors.roleNotAllowed();
        }

        const keepsAdmin = roles.some(r => r!.sourceTemplateKey === "school_admin");
        if (!keepsAdmin) {
            const admins = await d.membershipService.listActiveUserIdsByRoleKey("school_admin");
            if (admins.length === 1 && admins[0] === membership.userId) throw staffErrors.lastAdmin();
        }

        const before = await d.membershipService.replaceRoles(membership.id, ids, actor.userId);
        d.accessService.invalidate(membership.id);
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "staff.roles_changed", entity: "Staff", entityId: id,
            oldValue: { roleIds: before }, newValue: { roleIds: ids },
        });
        return { staffId: id, roleIds: ids };
    }
}

/*
| GET /staff/assignable-roles: the roles the signed-in person may hand out when inviting a staff member or changing their roles.
| Guarded by staff.manage (the permission every one of those actions needs), NOT roles.view, so a person who manages staff can
| fill the role picker without being given the wider right to browse and manage roles.
| It asks the same question as InviteStaffUseCase / ChangeStaffRolesUseCase (canGrantRole): a role that grants everything only for a
| school admin, any other role only when every permission in it is held at a scope at least as wide. A role the person could not
| grant is left out entirely, and no permission details are returned, only what a picker needs.
| It answers for the person, not for a particular staff member: branch scope, "not your own role", "last administrator" and the
| other per-person checks still run on the invite and change-roles calls themselves.
*/
export class ListAssignableStaffRolesUseCase {
    constructor(private readonly d: { staffPortalService: StaffPortalService }) {}

    async execute(actor: StaffActor) {
        const roles = await this.d.staffPortalService.listStaffRoles();
        const who = { isAdmin: actor.isAdmin, scopeOf: (k: string) => actor.access.scopeOf(k) };
        return roles
            .filter(r => canGrantRole(r, who))
            .map(r => ({ id: r.id, name: r.name, description: r.description, kind: r.kind, grantsAll: r.grantsAll }));
    }
}
