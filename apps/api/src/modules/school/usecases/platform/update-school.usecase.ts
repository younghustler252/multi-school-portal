import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { AuditService } from "../../../audit/services/audit.service";
import { schoolErrors } from "../../domain/school.errors";
import { PlatformUpdateSchoolDtoType } from "../../dtos/school.dto";

interface Dependencies { schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper; auditService: AuditService }

// Platform staff can change everything the school itself can no longer change after verification
export class UpdatePlatformSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: PlatformUpdateSchoolDtoType): Promise<PlatformSchoolResponseData> {
        const d = this.d;
        const row = await d.schoolRepository.findPlatformRow(schoolId);
        if (!row) throw schoolErrors.notFound();
        const school = row.school;

        if (dto.email && dto.email !== school.email && await d.schoolRepository.findByEmail(dto.email)) throw schoolErrors.emailTaken();

        const before: Record<string, unknown> = {};
        const after:  Record<string, unknown> = {};
        for (const [k, v] of Object.entries(dto)) {
            const cur = (school as unknown as Record<string, unknown>)[k];
            if (v !== undefined && v !== cur) { before[k] = cur; after[k] = v; }
        }
        const updated = Object.keys(after).length ? await d.schoolRepository.update(schoolId, after) : school;
        if (Object.keys(after).length) {
            await d.auditService.log({
                userId: actorUserId, schoolId, action: "school.updated_by_platform", entity: "School", entityId: schoolId,
                oldValue: before, newValue: after,
            });
        }
        return d.schoolMapper.toPlatformResponse(updated, row.plan, row.mrrKobo);
    }
}
