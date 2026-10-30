import { ISchoolSettingsRepository }  from "../repositories/school-settings.repository";
import { SchoolSettingsMapper, SchoolSettingsResponseData } from "../mappers/school-settings.mapper";
import { UpdateSchoolSettingsDtoType } from "../dtos/school-settings.dto";
import { EntitlementsService }        from "../../../foundation/entitlements.service";
import { AuditService }               from "../../audit/services/audit.service";
import { FeatureNotAvailableError }   from "../../../shared/errors/domain.errors";

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
    entitlementsService:      EntitlementsService;
    auditService:             AuditService;
}

/*
| UPDATE the school's look and report card template. Choosing the custom letterhead template (or setting a letterhead
| picture) needs the plan feature report_cards.letterhead; the check is the plan's entitlement, not a flag in the
| plan's JSON. The audit entry lists each field that really changed (old and new value).
*/
export class UpdateSchoolSettingsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: UpdateSchoolSettingsDtoType, schoolId: string, actorUserId: string): Promise<SchoolSettingsResponseData> {
        if (dto.reportCardTemplate === "custom_letterhead" || dto.reportCardLetterheadUrl) {
            const decision = await this.d.entitlementsService.checkFeature(schoolId, "report_cards.letterhead");
            if (!decision.allowed) throw new FeatureNotAvailableError("report_cards.letterhead");
        }

        const before = await this.d.schoolSettingsRepository.find();
        const saved  = await this.d.schoolSettingsRepository.upsert(dto);

        const changes = Object.entries(dto)
            .map(([field, to]) => ({ field, from: (before as any)?.[field] ?? null, to }))
            .filter(c => c.from !== c.to);
        if (changes.length) {
            await this.d.auditService.log({
                userId: actorUserId, schoolId, action: "school_settings.updated", entity: "SchoolSettings", entityId: saved.id,
                newValue: { changes },
            });
        }
        return this.d.schoolSettingsMapper.toResponse(saved);
    }
}
