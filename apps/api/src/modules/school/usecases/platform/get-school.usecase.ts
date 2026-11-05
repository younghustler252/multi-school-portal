import type { SchoolTenantRepository } from "../../repositories/school-tenant.repository";
import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { schoolErrors } from "../../domain/school.errors";
import { schoolState } from "../../domain/school.policy";

interface Dependencies { schoolRepository: ISchoolRepository; schoolTenantRepository: SchoolTenantRepository; schoolMapper: SchoolMapper }

export class GetPlatformSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string): Promise<PlatformSchoolResponseData & { studentCount: number | null; staffCount: number | null }> {
        const row = await this.d.schoolRepository.findPlatformRow(schoolId);
        if (!row) throw schoolErrors.notFound();

        let studentCount: number | null = null;
        let staffCount:   number | null = null;
        if (row.school.schemaName && schoolState(row.school) === "active") {
            try {
                const c = await this.d.schoolTenantRepository.activeCounts({ id: row.school.id, schemaName: row.school.schemaName });
                studentCount = c.students; staffCount = c.staff;
            } catch { /* the school's schema may be unavailable: counts stay null */ }
        }
        return { ...this.d.schoolMapper.toPlatformResponse(row.school, row.plan, row.mrrKobo), studentCount, staffCount };
    }
}
