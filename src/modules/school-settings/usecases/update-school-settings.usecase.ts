import { ISchoolSettingsRepository }      from "../repositories/school-settings.repository";
import { ISubscriptionRepository }        from "../../subscriptions/repositories/subscription.repository";
import { IPlanRepository }                from "../../plans/repositories/plan.repository";
import { SchoolSettingsMapper }           from "../mappers/school-settings.mapper";
import { SchoolSettingsResponseData }     from "../mappers/school-settings.mapper";
import { UpdateSchoolSettingsDtoType }    from "../dtos/school-settings.dto";
import { PlanFeatures }                   from "../../plans/domain/plan-features.interface";
import { ForbiddenError }                 from "../../../shared/errors/domain.errors";

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    subscriptionRepository:   ISubscriptionRepository;
    planRepository:           IPlanRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
}

export class UpdateSchoolSettingsUseCase {
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;
    private readonly subscriptionRepository:   ISubscriptionRepository;
    private readonly planRepository:           IPlanRepository;
    private readonly schoolSettingsMapper:     SchoolSettingsMapper;

    constructor({
        schoolSettingsRepository,
        subscriptionRepository,
        planRepository,
        schoolSettingsMapper,
    }: Dependencies) {
        this.schoolSettingsRepository = schoolSettingsRepository;
        this.subscriptionRepository   = subscriptionRepository;
        this.planRepository           = planRepository;
        this.schoolSettingsMapper     = schoolSettingsMapper;
    }

    async execute(
        dto:      UpdateSchoolSettingsDtoType,
        schoolId: string,
    ): Promise<SchoolSettingsResponseData> {

        if (dto.reportCardTemplate === "custom_letterhead" || dto.reportCardLetterheadUrl) {
            const subscription = await this.subscriptionRepository.findActiveBySchoolId(schoolId);
            const plan = subscription
                ? await this.planRepository.findById(subscription.planId)
                : null;
            const features = plan?.features as unknown as PlanFeatures | undefined;

            if (!features?.customReportCardTemplate) {
                throw new ForbiddenError(
                    "Custom letterhead report cards are only available on your plan's premium tier. Please upgrade to unlock this feature.",
                );
            }
        }

        const settings = await this.schoolSettingsRepository.upsert(dto);
        return this.schoolSettingsMapper.toResponse(settings);
    }
}