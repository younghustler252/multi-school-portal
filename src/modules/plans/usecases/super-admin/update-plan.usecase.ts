import { IPlanRepository }   from "../../repositories/plan.repository";
import { PlanMapper }        from "../../mappers/plan.mapper";
import { PlanResponseData }  from "../../mappers/plan.mapper";
import {
    NotFoundError,
    ConflictError,
}                            from "../../../../shared/errors/domain.errors";
import { PlanErrorMessage }  from "../../domain/plan.enums";
import { UpdatePlanDtoType } from "../../dtos/plan.dto";

/*
|--------------------------------------------------------------------------
| UPDATE PLAN USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    planRepository: IPlanRepository;
    planMapper:     PlanMapper;
}

export class UpdatePlanUseCase {
    private readonly planRepository: IPlanRepository;
    private readonly planMapper:     PlanMapper;

    constructor({ planRepository, planMapper }: Dependencies) {
        this.planRepository = planRepository;
        this.planMapper     = planMapper;
    }

    async execute(
        id:  string,
        dto: UpdatePlanDtoType,
    ): Promise<PlanResponseData> {

        // ── Find plan ─────────────────────────────────────────────────────
        const plan = await this.planRepository.findById(id);
        if (!plan) {
            throw new NotFoundError(PlanErrorMessage.NOT_FOUND);
        }

        // ── Check name not taken by another plan ──────────────────────────
        if (dto.name && dto.name !== plan.name) {
            const existing = await this.planRepository.findByName(dto.name);
            if (existing) {
                throw new ConflictError(PlanErrorMessage.NAME_TAKEN);
            }
        }

        // ── Merge features — don't replace entire object ──────────────────
        const updatedFeatures = dto.features
            ? { ...plan.features, ...dto.features }
            : plan.features;

        // ── Update ────────────────────────────────────────────────────────
        const updated = await this.planRepository.update(id, {
            ...dto,
            features: updatedFeatures,
        });

        return this.planMapper.toResponse(updated);
    }
}