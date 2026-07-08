import { IPlanRepository }   from "../../repositories/plan.repository";
import { PlanMapper }        from "../../mappers/plan.mapper";
import { PlanResponseData }  from "../../mappers/plan.mapper";
import { ConflictError }     from "../../../../shared/errors/domain.errors";
import { PlanErrorMessage }  from "../../domain/plan.enums";
import { CreatePlanDtoType } from "../../dtos/plan.dto";

/*
|--------------------------------------------------------------------------
| CREATE PLAN USE CASE
| Super admin creates a new plan
|--------------------------------------------------------------------------
*/

interface Dependencies {
    planRepository: IPlanRepository;
    planMapper:     PlanMapper;
}

export class CreatePlanUseCase {
    private readonly planRepository: IPlanRepository;
    private readonly planMapper:     PlanMapper;

    constructor({ planRepository, planMapper }: Dependencies) {
        this.planRepository = planRepository;
        this.planMapper     = planMapper;
    }

    async execute(dto: CreatePlanDtoType): Promise<PlanResponseData> {

        // ── Check name not taken ──────────────────────────────────────────
        const existing = await this.planRepository.findByName(dto.name);
        if (existing) {
            throw new ConflictError(PlanErrorMessage.NAME_TAKEN);
        }

        // ── Create plan ───────────────────────────────────────────────────
        const plan = await this.planRepository.create({
            ...dto,
            setupFeeKobo: dto.setupFeeKobo ?? 0,
            isPublic:     dto.isPublic     ?? true,
            isCustom:     dto.isCustom     ?? false,
            features:     dto.features     ?? {},
        });

        return this.planMapper.toResponse(plan);
    }
}