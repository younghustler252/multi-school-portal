import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { IStaffRepository } from "../repositories/staff.repository";
import { StaffMapper, StaffResponseData } from "../mappers/staff.mapper";
import { StaffPortalService } from "../services/staff-portal.service";
import { assertCanActOnStaff } from "../services/staff-scope";
import { staffErrors } from "../domain/staff.errors";
import { StaffActor } from "../domain/staff.types";
import { UpdateStaffDtoType } from "../dtos/staff.dto";

interface Dependencies {
    staffRepository: IStaffRepository; staffMapper: StaffMapper; staffPortalService: StaffPortalService; auditService: AuditService;
}

// Class and subject assignments a staff member currently holds (this term's subjects + classes they are teacher of)
export async function activeAssignments(staffId: string): Promise<number> {
    const db = getTenantClient();
    const [subjects, classes] = await Promise.all([
        db.classSubject.count({ where: { staffId, term: { isCurrent: true } } }),
        db.class.count({ where: { classTeacherId: staffId } }),
    ]);
    return subjects + classes;
}

const DATE_FIELDS = ["dateOfBirth", "joinDate"] as const;

/*
| UPDATE STAFF (details only). Branches, roles, portal access and active status each have their own action.
| Changing the email here does NOT change the person's login email (a login belongs to the person, not to one school).
| A teaching staff member who still has classes or subjects cannot be switched to non-teaching.
*/
export class UpdateStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UpdateStaffDtoType, actor: StaffActor): Promise<StaffResponseData> {
        const d = this.d;
        const staff = await d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        assertCanActOnStaff(actor.access, "staff.manage", staff.id, (staff.branches ?? []).map(b => b.id));

        if (dto.email && dto.email.toLowerCase() !== (staff.email ?? "").toLowerCase() && await d.staffRepository.findByEmail(dto.email)) throw staffErrors.emailTaken();
        if (dto.employeeId && dto.employeeId !== staff.employeeId && await d.staffRepository.findByEmployeeId(dto.employeeId)) throw staffErrors.employeeIdTaken();
        if (dto.category === "non_teaching" && staff.category === "teaching") {
            const n = await activeAssignments(staff.id);
            if (n > 0) throw staffErrors.hasAssignments(n);
        }

        const before: Record<string, unknown> = {};
        const after:  Record<string, unknown> = {};
        const data:   Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dto)) {
            if (value === undefined) continue;
            const current = (staff as unknown as Record<string, unknown>)[key];
            const next = (DATE_FIELDS as readonly string[]).includes(key) && value ? new Date(value as string) : value;
            const same = current instanceof Date && next instanceof Date ? current.getTime() === next.getTime() : current === next;
            if (same) continue;
            before[key] = current; after[key] = next; data[key] = next;
        }

        let updated = staff;
        if (Object.keys(data).length) {
            await d.staffRepository.update(id, { ...data, updatedById: actor.userId });
            updated = (await d.staffRepository.findWithBranches(id))!;
            await d.auditService.log({ userId: actor.userId, schoolId, action: "staff.updated", entity: "Staff", entityId: id, oldValue: before, newValue: after });
        }
        const portal = await d.staffPortalService.describe(schoolId, [id]);
        return d.staffMapper.toResponse(updated, portal.get(id));
    }
}
