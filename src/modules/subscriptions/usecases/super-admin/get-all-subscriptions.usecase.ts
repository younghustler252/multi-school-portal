// GetAllSubscriptionsUseCase — enriched
import { ISubscriptionRepository } from "../../repositories/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";
import { ISchoolRepository }       from "../../../school/repositories/school.repository";

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
    schoolRepository:       ISchoolRepository;
}

export class GetAllSubscriptionsUseCase {
    constructor(private readonly deps: Dependencies) {}

    async execute(params: { page?: number; limit?: number; status?: string }) {
        const result = await this.deps.subscriptionRepository.paginate({
            page: params.page ?? 1, limit: params.limit ?? 20,
            where: params.status ? { status: params.status } : {},
            orderBy: { createdAt: "desc" },
        });

        return {
            data: await Promise.all(result.data.map(async sub => {
                const [plan, school] = await Promise.all([
                    this.deps.planRepository.findById(sub.planId),
                    this.deps.schoolRepository.findById(sub.schoolId),
                ]);
                return {
                    ...sub,
                    planName:   plan?.name ?? "Unknown",
                    schoolName: school?.name ?? "Unknown",
                };
            })),
            meta: result.meta,
        };
    }
}