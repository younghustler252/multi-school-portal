import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { PlanMapper } from "../mappers/plan.mapper";
import { PlanEntity } from "../domain/plan.entity";
import { IPlanRepository } from "./plan.repository";

export class PlanRepositoryImpl
    extends BasePublicRepository<PlanEntity>
    implements IPlanRepository
{
    protected readonly modelName = "plan";

    constructor({ planMapper }: { planMapper: PlanMapper }) {
        super(planMapper);
    }

    async findByName(name: string): Promise<PlanEntity | null> {
        return this.findOne({ name });
    }

    async findPublicPlans(): Promise<PlanEntity[]> {
        return this.findMany(
            { isPublic: true, isActive: true },
            undefined,
            { monthlyPriceKobo: "asc" },
        );
    }

    async findFreePlan(): Promise<PlanEntity | null> {
        return this.findOne({
            name:     "Free",
            isActive: true,
        });
    }
}