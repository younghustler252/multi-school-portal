import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { TenantContext } from "../../../../infrastructure/database/prisma/tenant.context";
import { schoolErrors } from "../../domain/school.errors";
import { schoolState } from "../../domain/school.policy";

interface Dependencies { schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper }

export class GetPlatformSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string): Promise<PlatformSchoolResponseData & { studentCount: number | null; staffCount: number | null }> {
        const row = await this.d.schoolRepository.findPlatformRow(schoolId);
        if (!row) throw schoolErrors.notFound();

        let studentCount: number | null = null;
        let staffCount:   number | null = null;
        if (row.school.schemaName && schoolState(row.school) === "active") {
            try {
                [studentCount, staffCount] = await TenantContext.run(
                    { tenantSchema: row.school.schemaName, schoolId: row.school.id },
                    async () => { const db = getTenantClient(); return Promise.all([db.student.count({ where: { isActive: true } }), db.staff.count({ where: { isActive: true } })]); },
                );
            } catch { /* the school's schema may be unavailable: counts stay null */ }
        }
        return { ...this.d.schoolMapper.toPlatformResponse(row.school, row.plan, row.mrrKobo), studentCount, staffCount };
    }
}
