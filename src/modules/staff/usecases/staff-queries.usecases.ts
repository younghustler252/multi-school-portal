import { IStaffRepository } from "../repositories/staff.repository";
import { WITH_BRANCHES } from "../repositories/staff.repository.impl";
import { StaffMapper, StaffResponseData } from "../mappers/staff.mapper";
import { StaffPortalService } from "../services/staff-portal.service";
import { assertCanActOnStaff, staffScopeWhere } from "../services/staff-scope";
import { staffErrors } from "../domain/staff.errors";
import { EXPORT_MAX_ROWS } from "../domain/staff.policy";
import { ListStaffQueryType } from "../dtos/staff.dto";
import type { Access } from "../../../foundation/access.service";

interface Dependencies { staffRepository: IStaffRepository; staffMapper: StaffMapper; staffPortalService: StaffPortalService }

// Builds the filter: what the viewer may see AND what they asked for
function buildWhere(q: Omit<ListStaffQueryType, "page" | "limit">, access: Access): Record<string, unknown> {
    const and: Record<string, unknown>[] = [staffScopeWhere(access, "staff.view")];

    if (q.status === "active")   and.push({ isActive: true });
    if (q.status === "inactive") and.push({ isActive: false });
    if (q.category)       and.push({ category: q.category });
    if (q.employmentType) and.push({ employmentType: q.employmentType });
    if (q.department)     and.push({ department: { equals: q.department, mode: "insensitive" } });
    if (q.branchId) {
        const scope = access.branchScope("staff.view");
        if (Array.isArray(scope) && !scope.includes(q.branchId)) throw staffErrors.branchOutOfScope();
        and.push({ branches: { some: { branchId: q.branchId } } });
    }
    if (q.search) {
        const s = q.search;
        and.push({ OR: [
            { firstName:  { contains: s, mode: "insensitive" } }, { lastName:   { contains: s, mode: "insensitive" } },
            { email:      { contains: s, mode: "insensitive" } }, { employeeId: { contains: s, mode: "insensitive" } },
            { phone:      { contains: s } },
        ] });
    }
    return { AND: and };
}

/*
| LIST STAFF: scoped to the viewer's branches, filtered, searched, paginated.
| The old version looked up each staff member's login one at a time (a database call per row, across two
| databases); names now live on the staff record, so a page is one query plus one batched portal lookup.
*/
export class ListStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, q: ListStaffQueryType, access: Access) {
        const d = this.d;
        const result = await d.staffRepository.paginate({
            page: q.page, limit: q.limit, where: buildWhere(q, access),
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }] as never, include: WITH_BRANCHES as never,
        });
        const portal = await d.staffPortalService.describe(schoolId, result.data.map(s => s.id));
        return { data: result.data.map(s => d.staffMapper.toResponse(s, portal.get(s.id))), meta: result.meta };
    }
}

export class GetStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, access: Access): Promise<StaffResponseData> {
        const staff = await this.d.staffRepository.findWithBranches(id);
        if (!staff) throw staffErrors.notFound();
        assertCanActOnStaff(access, "staff.view", staff.id, (staff.branches ?? []).map(b => b.id));
        const portal = await this.d.staffPortalService.describe(schoolId, [staff.id]);
        return this.d.staffMapper.toResponse(staff, portal.get(staff.id));
    }
}

// The signed-in staff member's own record (no permission needed beyond being staff)
export class GetMyStaffProfileUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, access: Access): Promise<StaffResponseData> {
        if (!access.personaEntityId) throw staffErrors.notFound();
        const staff = await this.d.staffRepository.findWithBranches(access.personaEntityId);
        if (!staff) throw staffErrors.notFound();
        const portal = await this.d.staffPortalService.describe(schoolId, [staff.id]);
        return this.d.staffMapper.toResponse(staff, portal.get(staff.id));
    }
}

// CSV of the same filtered list. Cells that start with = + - @ are neutralised so a spreadsheet never runs them as a formula.
const csvCell = (v: unknown): string => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
};

export class ExportStaffUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: Omit<ListStaffQueryType, "page" | "limit">, access: Access): Promise<string> {
        const rows = await this.d.staffRepository.findMany(
            buildWhere(q, access), WITH_BRANCHES as never, [{ lastName: "asc" }, { firstName: "asc" }] as never,
        );
        const header = ["Employee ID", "First name", "Last name", "Email", "Phone", "Category", "Employment", "Department", "Designation", "Branches", "Joined", "Status"];
        const lines = rows.slice(0, EXPORT_MAX_ROWS).map(s => [
            s.employeeId, s.firstName, s.lastName, s.email, s.phone, s.category, s.employmentType, s.department, s.designation,
            (s.branches ?? []).map(b => b.name).join("; "), s.joinDate, s.isActive ? "active" : "inactive",
        ].map(csvCell).join(","));
        return [header.map(csvCell).join(","), ...lines].join("\r\n");
    }
}
