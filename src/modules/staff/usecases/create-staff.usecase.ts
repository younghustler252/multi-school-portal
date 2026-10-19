import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { assertWithinPlanLimit } from "../../../infrastructure/middleware/feature-gate.middleware";
import { AuditService } from "../../audit/services/audit.service";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { IStaffRepository } from "../repositories/staff.repository";
import { StaffMapper, StaffResponseData } from "../mappers/staff.mapper";
import { StaffPortalService } from "../services/staff-portal.service";
import { InviteStaffUseCase } from "./staff-portal.usecases";
import { staffErrors } from "../domain/staff.errors";
import { EMPLOYEE_ID_SEQUENCE, formatEmployeeId } from "../domain/staff.policy";
import { StaffActor } from "../domain/staff.types";
import { CreateStaffDtoType } from "../dtos/staff.dto";
import type { Access } from "../../../foundation/access.service";

interface Dependencies {
    staffRepository: IStaffRepository; staffMapper: StaffMapper; staffPortalService: StaffPortalService;
    numberSequenceService: NumberSequenceService; auditService: AuditService; inviteStaffUseCase: InviteStaffUseCase;
}

// Which branches does a new staff member start in? Validates scope and that every branch exists and is active.
export async function resolveBranchIds(requested: string[] | undefined, access: Access): Promise<string[]> {
    const db = getTenantClient();
    const scope = access.branchScope("staff.manage");
    let ids = requested ? [...new Set(requested)] : undefined;

    if (!ids) {
        if (Array.isArray(scope) && scope.length === 1) ids = [scope[0]];
        else if (Array.isArray(scope) && scope.length > 1) throw staffErrors.branchesInvalid();   // several branches: the person must choose
        else {
            const main = await db.branch.findFirst({ where: { isMain: true, deletedAt: null }, select: { id: true } });
            if (!main) throw staffErrors.branchesInvalid();
            ids = [main.id];
        }
    }
    if (Array.isArray(scope) && ids.some(b => !scope.includes(b))) throw staffErrors.branchOutOfScope();
    const valid = await db.branch.count({ where: { id: { in: ids }, isActive: true, deletedAt: null } });
    if (valid !== ids.length) throw staffErrors.branchesInvalid();
    return ids;
}

/*
|--------------------------------------------------------------------------
| CREATE STAFF
| Creates the school's record of a person who works there. NO login is created here:
| a login only exists after the person is invited and accepts (they choose their own password;
| the old version emailed a temporary password and created a login for everyone).
|  - the plan's staff limit is checked first (by quantity)
|  - a person may be placed in several branches; the first listed is the primary one
|  - same email, or same employee id, is refused; same name + phone asks for confirmation
|  - the employee number is made automatically (STF-0001...) inside the same transaction as the record
|  - optional `invite` sends the portal invitation straight away; if that fails the staff member is
|    still created and the response says the invitation failed
|--------------------------------------------------------------------------
*/
export class CreateStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: CreateStaffDtoType, actor: StaffActor): Promise<StaffResponseData & { invite?: { status: "sent" | "failed"; code?: string } }> {
        const d = this.d;
        await assertWithinPlanLimit(schoolId, "staff", 1);

        const branchIds = await resolveBranchIds(dto.branchIds, actor.access);

        if (dto.email && await d.staffRepository.findByEmail(dto.email)) throw staffErrors.emailTaken();
        if (dto.employeeId && await d.staffRepository.findByEmployeeId(dto.employeeId)) throw staffErrors.employeeIdTaken();
        if (!dto.confirmNotDuplicate && dto.phone) {
            const dup = await d.staffRepository.findOne({
                firstName: { equals: dto.firstName, mode: "insensitive" }, lastName: { equals: dto.lastName, mode: "insensitive" }, phone: dto.phone,
            });
            if (dup) throw staffErrors.possibleDuplicate(dup.id);
        }

        const db = getTenantClient();
        let created: { id: string } | null = null;
        for (let attempt = 0; attempt < 5 && !created; attempt++) {
            try {
                created = await db.$transaction(async tx => {
                    const employeeId = dto.employeeId ?? formatEmployeeId(await d.numberSequenceService.next(EMPLOYEE_ID_SEQUENCE, "", tx));
                    const s = await tx.staff.create({
                        data: {
                            employeeId, firstName: dto.firstName, lastName: dto.lastName, middleName: dto.middleName, email: dto.email, phone: dto.phone,
                            gender: dto.gender, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined, address: dto.address,
                            department: dto.department, designation: dto.designation, qualification: dto.qualification,
                            category: dto.category, employmentType: dto.employmentType, joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
                            isActive: true, createdById: actor.userId,
                        },
                        select: { id: true },
                    });
                    await tx.staffBranch.createMany({ data: branchIds.map((branchId, i) => ({ staffId: s.id, branchId, isPrimary: i === 0, assignedById: actor.userId })) });
                    return s;
                });
            } catch (err: any) {
                // An automatic number collided with a hand-typed one: the counter has moved on, try the next number
                if (err?.code === "P2002" && !dto.employeeId) continue;
                if (err?.code === "P2002") throw staffErrors.employeeIdTaken();
                throw err;
            }
        }
        if (!created) throw staffErrors.employeeIdTaken();

        await d.auditService.log({
            userId: actor.userId, schoolId, action: "staff.created", entity: "Staff", entityId: created.id,
            newValue: { name: `${dto.firstName} ${dto.lastName}`, category: dto.category, branchIds },
        });

        const staff = (await d.staffRepository.findWithBranches(created.id))!;
        const portal = await d.staffPortalService.describe(schoolId, [staff.id]);
        const response: StaffResponseData & { invite?: { status: "sent" | "failed"; code?: string } } = d.staffMapper.toResponse(staff, portal.get(staff.id));

        if (dto.invite) {
            try {
                await d.inviteStaffUseCase.execute(schoolId, staff.id, { roleId: dto.invite.roleId }, actor);
                response.invite = { status: "sent" };
                response.portal = { ...response.portal, status: "invited" };
            } catch (err: any) {
                response.invite = { status: "failed", code: err?.code ?? "INVITE_FAILED" };
            }
        }
        return response;
    }
}
