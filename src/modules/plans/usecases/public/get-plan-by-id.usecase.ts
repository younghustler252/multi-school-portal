import { IPlanRepository }  from "../../repositories/plan.repository";
import { PlanMapper }       from "../../mappers/plan.mapper";
import { PlanResponseData } from "../../mappers/plan.mapper";
import { NotFoundError }    from "../../../../shared/errors/domain.errors";
import { PlanErrorMessage } from "../../domain/plan.enums";

/*
|--------------------------------------------------------------------------
| GET PLAN BY ID USE CASE
| Public — anyone can view a specific plan
|--------------------------------------------------------------------------
*/

interface Dependencies {
    planRepository: IPlanRepository;
    planMapper:     PlanMapper;
}

export class GetPlanByIdUseCase {
    private readonly planRepository: IPlanRepository;
    private readonly planMapper:     PlanMapper;

    constructor({ planRepository, planMapper }: Dependencies) {
        this.planRepository = planRepository;
        this.planMapper     = planMapper;
    }

    async execute(id: string): Promise<PlanResponseData> {
        const plan = await this.planRepository.findById(id);

        if (!plan) {
            throw new NotFoundError(PlanErrorMessage.NOT_FOUND);
        }

        return this.planMapper.toResponse(plan);
    }
}