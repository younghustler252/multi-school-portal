import { Request, Response, NextFunction } from "express";
import { CreatePlanUseCase }  from "../usecases/super-admin/create-plan.usecase";
import { GetPlansUseCase }    from "../usecases/public/get-plans.usecase";
import { UpdatePlanUseCase }  from "../usecases/super-admin/update-plan.usecase";
import { SeedPlansUseCase }   from "../usecases/super-admin/seed-plans.usecase";
import { GetPlanByIdUseCase } from "../usecases/public/get-plan-by-id.usecase";
import { DeletePlanUseCase }  from "../usecases/super-admin/delete-plan.usecase";

import {
    sendSuccess,
    sendCreated,
}                             from "../../../shared/utils/api-response";
import { Role }               from "../../../generated/prisma/enums";

/*
|--------------------------------------------------------------------------
| PLAN CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    createPlanUseCase: CreatePlanUseCase;
    getPlansUseCase:   GetPlansUseCase;
    updatePlanUseCase: UpdatePlanUseCase;
    seedPlansUseCase:  SeedPlansUseCase;
    getPlanByIdUseCase: GetPlanByIdUseCase;
    deletePlanUseCase: DeletePlanUseCase;
}

export class PlanController {
    private readonly createPlanUseCase: CreatePlanUseCase;
    private readonly getPlansUseCase:   GetPlansUseCase;
    private readonly updatePlanUseCase: UpdatePlanUseCase;
    private readonly seedPlansUseCase:  SeedPlansUseCase;
    private readonly getPlanByIdUseCase: GetPlanByIdUseCase;
    private readonly deletePlanUseCase: DeletePlanUseCase;

    constructor({
        createPlanUseCase,
        getPlansUseCase,
        updatePlanUseCase,
        seedPlansUseCase,
        getPlanByIdUseCase,
        deletePlanUseCase,
    }: Dependencies) {
        this.createPlanUseCase = createPlanUseCase;
        this.getPlansUseCase   = getPlansUseCase;
        this.updatePlanUseCase = updatePlanUseCase;
        this.seedPlansUseCase  = seedPlansUseCase;
        this.getPlanByIdUseCase = getPlanByIdUseCase;
        this.deletePlanUseCase = deletePlanUseCase;
    }

    // ── Get all plans (public) ────────────────────────────────────────────
    getPlans = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const isAdmin = req.user?.role === Role.super_admin;
            const result  = await this.getPlansUseCase.execute(isAdmin);
            sendSuccess(res, result, "Plans retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Create plan (super admin) ─────────────────────────────────────────
    createPlan = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createPlanUseCase.execute(req.body);
            sendCreated(res, result, "Plan created successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Update plan (super admin) ─────────────────────────────────────────
    updatePlan = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updatePlanUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Plan updated successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Seed default plans (super admin) ──────────────────────────────────
    seedPlans = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.seedPlansUseCase.execute();
            sendCreated(res, result, "Default plans seeded successfully");
        } catch (err) {
            next(err);
        }
    };

    getPlanById = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getPlanByIdUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Plan retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    deletePlan = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.deletePlanUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Plan deleted successfully");
        } catch (err) {
            next(err);
        }
    };
}