import { ISchoolRepository }       from "../../repositories/school.repository";
import { ISubscriptionRepository } from "../../../subscriptions/repositories/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";
import { SchoolMapper, SchoolResponseData } from "../../mappers/school.mapper";
import { TenantContext }           from "../../../../infrastructure/database/prisma/tenant.context";
import { getTenantClient }         from "../../../../infrastructure/database/prisma/prisma.client";
import { PaginatedResult }         from "../../../../infrastructure/repository/base.repository";

interface Dependencies {
    schoolRepository:       ISchoolRepository;
    schoolMapper:           SchoolMapper;
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
}
export interface AdminSchoolResponseData extends SchoolResponseData {
    planId:       string | null;
    planName:     string | null;
    studentCount: number;
    mrrKobo:      number;
}   
export class GetAllSchoolsUseCase {
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

    async execute(params: {
        page?:               number;
        limit?:              number;
        status?:             string;
        verificationStatus?: string;
        search?:             string;
    }): Promise<PaginatedResult<AdminSchoolResponseData>> {

        const where: Record<string, any> = {};

        if (params.status)             where.status             = params.status;
        if (params.verificationStatus) where.verificationStatus = params.verificationStatus;

        if (params.search) {
            where.OR = [
                { name:      { contains: params.search, mode: "insensitive" } },
                { email:     { contains: params.search, mode: "insensitive" } },
                { subdomain: { contains: params.search, mode: "insensitive" } },
            ];
        }

        const result = await this.schoolRepository.paginate({
            page:  params.page,
            limit: params.limit,
            where,
            orderBy: { createdAt: "desc" },
        });

        // Bounded by page size (not total schools), so per-item enrichment
        // here is acceptable — unlike the platform-stats total, which loops
        // *every* school.
        const enriched = await Promise.all(
            result.data.map(async school => {
                const base = this.schoolMapper.toResponse(school);

                let planId: string | null = null;
                let planName: string | null = null;
                let mrrKobo = 0;

                const subscription = await this.subscriptionRepository.findActiveBySchoolId(school.id);
                if (subscription) {
                    const plan = await this.planRepository.findById(subscription.planId);
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
                            { tenantSchema: school.schemaName, schoolId: school.id },
                            () => getTenantClient().student.count({ where: { isActive: true } }),
                        );
                    } catch {
                        studentCount = 0;
                    }
                }

                return { ...base, planId, planName, studentCount, mrrKobo };
            }),
        );

        return { data: enriched, meta: result.meta };
    }
}
