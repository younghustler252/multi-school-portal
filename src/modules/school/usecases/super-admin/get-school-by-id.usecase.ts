import { ISchoolRepository }       from "../../repositories/school.repository";
import { ISubscriptionRepository } from "../../../subscriptions/repositories/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";
import { SchoolMapper }            from "../../mappers/school.mapper";
import { TenantContext }           from "../../../../infrastructure/database/prisma/tenant.context";
import { getTenantClient }         from "../../../../infrastructure/database/prisma/prisma.client";
import { NotFoundError }           from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }      from "../../domain/school.enum";
import { AdminSchoolResponseData } from "./get-all-schools.usecase";

interface Dependencies {
    schoolRepository:       ISchoolRepository;
    schoolMapper:           SchoolMapper;
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
}

export class GetSchoolByIdUseCase {
    private readonly schoolRepository:       ISchoolRepository;
    private readonly schoolMapper:           SchoolMapper;
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository:         IPlanRepository;

    constructor({
        schoolRepository,
        schoolMapper,
        subscriptionRepository,
        planRepository,
    }: Dependencies) {
        this.schoolRepository       = schoolRepository;
        this.schoolMapper           = schoolMapper;
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository         = planRepository;
    }

    async execute(schoolId: string): Promise<AdminSchoolResponseData> {
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        const base = this.schoolMapper.toResponse(school);

        let planId: string | null = null;
        let planName: string | null = null;
        let mrrKobo = 0;

        const subscription =
            await this.subscriptionRepository.findActiveBySchoolId(schoolId);

        if (subscription) {
            const plan =
                await this.planRepository.findById(subscription.planId);

            if (plan) {
                planId   = plan.id;
                planName = plan.name;
                mrrKobo  = subscription.billingCycle === "yearly"
                    ? Math.round(plan.yearlyPriceKobo / 12)
                    : plan.monthlyPriceKobo;
            }
        }

        let studentCount = 0;

        if (school.schemaName) {
            try {
                studentCount = await TenantContext.run(
                    {
                        tenantSchema: school.schemaName,
                        schoolId: school.id,
                    },
                    () =>
                        getTenantClient().student.count({
                            where: { isActive: true },
                        }),
                );
            } catch {
                studentCount = 0;
            }
        }

        return {
            ...base,
            planId,
            planName,
            studentCount,
            mrrKobo,
        };
    }
}
