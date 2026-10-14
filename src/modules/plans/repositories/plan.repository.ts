import { PlanEntity } from "../domain/plan.entity";
import { PaginatedResult, PaginateParams } from "../../../infrastructure/repository/base.repository";

export interface IPlanRepository {
    // ── Base (kept exactly as other modules use them) ────────────────────
    findById(id: string):                              Promise<PlanEntity | null>;
    findOne(where: Record<string, any>):               Promise<PlanEntity | null>;
    findMany(where?: Record<string, any>):             Promise<PlanEntity[]>;
    paginate(params: PaginateParams):                  Promise<PaginatedResult<PlanEntity>>;
    create(data: Record<string, any>):                 Promise<PlanEntity>;
    update(id: string, data: Record<string, any>):     Promise<PlanEntity>;
    delete(id: string):                                Promise<PlanEntity>;
    exists(where: Record<string, any>):                Promise<boolean>;
    count(where?: Record<string, any>):                Promise<number>;

    // ── Plan specific ────────────────────────────────────────────────────
    findByName(name: string):          Promise<PlanEntity | null>;
    findBySystemKey(key: string):      Promise<PlanEntity | null>;
    findPublicPlans():                 Promise<PlanEntity[]>;      // public + active, cheapest first
    listAll():                         Promise<PlanEntity[]>;      // everything, cheapest first (platform console)
    findFreePlan():                    Promise<PlanEntity | null>; // the built-in Free plan, found by its system key (not its name)
}
