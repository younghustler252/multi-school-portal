import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { PlanMapper } from "../mappers/plan.mapper";
import { PlanEntity } from "../domain/plan.entity";
import { IPlanRepository } from "./plan.repository";

export class PlanRepositoryImpl extends BasePublicRepository<PlanEntity> implements IPlanRepository {
    protected readonly modelName = "plan";
    private readonly planMapper: PlanMapper;

    constructor({ planMapper }: { planMapper: PlanMapper }) {
        super(planMapper);
        this.planMapper = planMapper;
    }

    async findByName(name: string): Promise<PlanEntity | null> {
        return this.findOne({ name });
    }

    async findBySystemKey(key: string): Promise<PlanEntity | null> {
        return this.findOne({ systemKey: key });
    }

    async findPublicPlans(): Promise<PlanEntity[]> {
        const rows = await this.prisma.plan.findMany({
            where: { isPublic: true, isActive: true }, orderBy: [{ monthlyPriceKobo: "asc" }, { name: "asc" }],
        });
        return rows.map(r => this.planMapper.toDomain(r));
    }

    async listAll(): Promise<PlanEntity[]> {
        const rows = await this.prisma.plan.findMany({ orderBy: [{ monthlyPriceKobo: "asc" }, { name: "asc" }] });
        return rows.map(r => this.planMapper.toDomain(r));
    }

    // Found by system key so renaming the plan in the console can never break registration
    async findFreePlan(): Promise<PlanEntity | null> {
        const plan = await this.findOne({ systemKey: "free" });
        return plan && plan.isActive ? plan : null;
    }
}
