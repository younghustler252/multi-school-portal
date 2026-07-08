import { PlanEntity }        from "../domain/plan.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| PLAN REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IPlanRepository {
    findById(id: string):                          Promise<PlanEntity | null>;
    findOne(where: Record<string, any>):           Promise<PlanEntity | null>;
    findMany(where?: Record<string, any>):         Promise<PlanEntity[]>;
    paginate(params: PaginateParams):              Promise<PaginatedResult<PlanEntity>>;
    create(data: Record<string, any>):             Promise<PlanEntity>;
    update(id: string, data: Record<string, any>): Promise<PlanEntity>;
    delete(id: string):                            Promise<PlanEntity>;
    exists(where: Record<string, any>):            Promise<boolean>;
    count(where?: Record<string, any>):            Promise<number>;

    // ── Plan specific ─────────────────────────────────────────────────────
    findByName(name: string):                      Promise<PlanEntity | null>;
    findPublicPlans():                             Promise<PlanEntity[]>;
    findFreePlan():                                Promise<PlanEntity | null>;
}