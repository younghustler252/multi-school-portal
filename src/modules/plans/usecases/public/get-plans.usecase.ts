import { IPlanRepository }  from "../../repositories/plan.repository";
import { PlanMapper }       from "../../mappers/plan.mapper";
import { PlanResponseData } from "../../mappers/plan.mapper";

/*
|--------------------------------------------------------------------------
| GET PLANS USE CASE
| Public — returns all active public plans (for signup page)
| Super admin — returns all plans including custom/private
|--------------------------------------------------------------------------
*/

interface Dependencies {
    planRepository: IPlanRepository;
    planMapper:     PlanMapper;
}

export class GetPlansUseCase {
    private readonly planRepository: IPlanRepository;
    private readonly planMapper:     PlanMapper;

    constructor({ planRepository, planMapper }: Dependencies) {
        this.planRepository = planRepository;
        this.planMapper     = planMapper;
    }

    async execute(
        isAdmin = false,
    ): Promise<PlanResponseData[]> {
        const plans = isAdmin
            ? await this.planRepository.findMany()
            : await this.planRepository.findPublicPlans();

        return plans.map(p => this.planMapper.toResponse(p));
    }
}