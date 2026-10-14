import { ISchoolRepository } from "../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../mappers/school.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { schoolErrors } from "../domain/school.errors";
import { isVerified } from "../domain/school.policy";
import { UpdateSchoolDtoType } from "../dtos/school.dto";

interface Dependencies { schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper; auditService: AuditService }

// Verification was granted for a specific name, category and ownership type; those change only through the platform
const LOCKED_AFTER_VERIFICATION = ["name", "schoolCategory", "schoolOwnership"] as const;

export class UpdateSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: UpdateSchoolDtoType): Promise<SchoolResponseData> {
        const d = this.d;
        const school = await d.schoolRepository.findById(schoolId);
        if (!school) throw schoolErrors.notFound();

        if (isVerified(school)) {
            const locked = LOCKED_AFTER_VERIFICATION.filter(f => dto[f] !== undefined && dto[f] !== school[f]);
            if (locked.length) throw schoolErrors.fieldLocked([...locked]);
        }

        if (dto.email && dto.email !== school.email && await d.schoolRepository.findByEmail(dto.email)) {
            throw schoolErrors.emailTaken();
        }

        const before: Record<string, unknown> = {};
        const after:  Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dto)) {
            const current = (school as unknown as Record<string, unknown>)[key];
            if (value !== undefined && value !== current) { before[key] = current; after[key] = value; }
        }
        if (!Object.keys(after).length) return d.schoolMapper.toResponse(school);

        const updated = await d.schoolRepository.update(schoolId, after);
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "school.updated", entity: "School", entityId: schoolId,
            oldValue: before, newValue: after,
        });
        return d.schoolMapper.toResponse(updated);
    }
}
