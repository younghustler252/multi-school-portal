import { Request, Response, NextFunction } from "express";
import { GetPublicPlansUseCase } from "../usecases/get-public-plans.usecase";
import { GetPublicPlanUseCase }  from "../usecases/get-public-plan.usecase";
import { sendSuccess } from "../../../shared/utils/api-response";

interface Dependencies { getPublicPlansUseCase: GetPublicPlansUseCase; getPublicPlanUseCase: GetPublicPlanUseCase }

// PUBLIC plan endpoints (pricing page). No login, no identity.
export class PlanController {
    constructor(private readonly d: Dependencies) {}

    getPlans = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getPublicPlansUseCase.execute(), "Plans retrieved successfully"); } catch (e) { next(e); }
    };

    getPlanById = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getPublicPlanUseCase.execute(String(req.params.id)), "Plan retrieved successfully"); } catch (e) { next(e); }
    };
}
