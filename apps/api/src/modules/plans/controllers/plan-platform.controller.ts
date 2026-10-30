import { Request, Response, NextFunction } from "express";
import { ListPlansUseCase }            from "../usecases/platform/list-plans.usecase";
import { GetPlatformPlanUseCase }      from "../usecases/platform/get-plan.usecase";
import { CreatePlanUseCase }           from "../usecases/platform/create-plan.usecase";
import { UpdatePlanUseCase }           from "../usecases/platform/update-plan.usecase";
import { SetPlanEntitlementsUseCase }  from "../usecases/platform/set-plan-entitlements.usecase";
import { DeactivatePlanUseCase, ReactivatePlanUseCase } from "../usecases/platform/plan-status.usecases";
import { ClonePlanUseCase }            from "../usecases/platform/clone-plan.usecase";
import { sendSuccess, sendCreated }    from "../../../shared/utils/api-response";
import { planErrors }                  from "../domain/plan.errors";

interface Dependencies {
    listPlansUseCase: ListPlansUseCase; getPlatformPlanUseCase: GetPlatformPlanUseCase; createPlanUseCase: CreatePlanUseCase;
    updatePlanUseCase: UpdatePlanUseCase; setPlanEntitlementsUseCase: SetPlanEntitlementsUseCase;
    deactivatePlanUseCase: DeactivatePlanUseCase; reactivatePlanUseCase: ReactivatePlanUseCase; clonePlanUseCase: ClonePlanUseCase;
}

const actorOf = (req: Request): string => { if (!req.auth) throw planErrors.notFound(); return req.auth.userId; };
const idOf = (req: Request): string => String(req.params.id);

// PLATFORM plan endpoints, mounted at /platform/plans
export class PlanPlatformController {
    constructor(private readonly d: Dependencies) {}

    list = async (_q: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listPlansUseCase.execute(), "Plans retrieved successfully"); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getPlatformPlanUseCase.execute(idOf(req)), "Plan retrieved successfully"); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createPlanUseCase.execute(req.body, actorOf(req)), "Plan created successfully"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updatePlanUseCase.execute(idOf(req), actorOf(req), req.body), "Plan updated successfully"); } catch (e) { next(e); }
    };
    setEntitlements = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.setPlanEntitlementsUseCase.execute(idOf(req), actorOf(req), req.body), "Plan features updated successfully"); } catch (e) { next(e); }
    };
    deactivate = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deactivatePlanUseCase.execute(idOf(req), actorOf(req)), "Plan deactivated successfully"); } catch (e) { next(e); }
    };
    reactivate = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.reactivatePlanUseCase.execute(idOf(req), actorOf(req)), "Plan reactivated successfully"); } catch (e) { next(e); }
    };
    clone = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.clonePlanUseCase.execute(idOf(req), actorOf(req), req.body), "Plan cloned successfully"); } catch (e) { next(e); }
    };
}
