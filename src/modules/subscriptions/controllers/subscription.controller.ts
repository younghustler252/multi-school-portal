import { Request, Response, NextFunction } from "express";
import { CreateSubscriptionUseCase }  from "../usecases/super-admin/create-subscription.usecase";
import { GetSubscriptionUseCase }     from "../usecases/school-admin/get-subscription.usecase";
import { UpgradePlanUseCase }         from "../usecases/school-admin/upgrade-plan.usecase";
import { CancelSubscriptionUseCase }  from "../usecases/school-admin/cancel-subscription.usecase";
import { GetAllSubscriptionsUseCase }      from "../usecases/super-admin/get-all-subscriptions.usecase";
import { GetSubscriptionBySchoolUseCase }  from "../usecases/super-admin/get-subscription-by-school.usecase";
import { DeactivateSubscriptionUseCase }   from "../usecases/super-admin/deactivate-subscription.usecase";

import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                     from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    createSubscriptionUseCase: CreateSubscriptionUseCase;
    getSubscriptionUseCase:    GetSubscriptionUseCase;
    upgradePlanUseCase:        UpgradePlanUseCase;
    cancelSubscriptionUseCase: CancelSubscriptionUseCase;
    getAllSubscriptionsUseCase: GetAllSubscriptionsUseCase;
    getSubscriptionBySchoolUseCase: GetSubscriptionBySchoolUseCase;
    deactivateSubscriptionUseCase: DeactivateSubscriptionUseCase;
}

export class SubscriptionController {
    private readonly createSubscriptionUseCase: CreateSubscriptionUseCase;
    private readonly getSubscriptionUseCase:    GetSubscriptionUseCase;
    private readonly upgradePlanUseCase:        UpgradePlanUseCase;
    private readonly cancelSubscriptionUseCase: CancelSubscriptionUseCase;
    private readonly getAllSubscriptionsUseCase: GetAllSubscriptionsUseCase;
    private readonly getSubscriptionBySchoolUseCase: GetSubscriptionBySchoolUseCase;
    private readonly deactivateSubscriptionUseCase: DeactivateSubscriptionUseCase;

    constructor({
        createSubscriptionUseCase,
        getSubscriptionUseCase,
        upgradePlanUseCase,
        cancelSubscriptionUseCase,
        getAllSubscriptionsUseCase,
        getSubscriptionBySchoolUseCase,
        deactivateSubscriptionUseCase,
    }: Dependencies) {
        this.createSubscriptionUseCase = createSubscriptionUseCase;
        this.getSubscriptionUseCase    = getSubscriptionUseCase;
        this.upgradePlanUseCase        = upgradePlanUseCase;
        this.cancelSubscriptionUseCase = cancelSubscriptionUseCase;
        this.getAllSubscriptionsUseCase = getAllSubscriptionsUseCase;
        this.getSubscriptionBySchoolUseCase = getSubscriptionBySchoolUseCase;
        this.deactivateSubscriptionUseCase = deactivateSubscriptionUseCase;
    }

    // ── Get own subscription ──────────────────────────────────────────────
    getMySubscription = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const schoolId = req.user?.schoolId;

            if (!schoolId) {
                res.status(400).json({
                    success: false,
                    message: "This endpoint is only available to school users",
                });
                return;
            }

            const result = await this.getSubscriptionUseCase.execute(schoolId);
            sendSuccess(res, result, "Subscription retrieved successfully");
        } catch (err) {
            next(err);
        }
    };
    // ── Upgrade plan ──────────────────────────────────────────────────────
    upgradePlan = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.upgradePlanUseCase.execute(
                req.user!.schoolId!,
                req.body,
            );
            sendSuccess(res, result, "Plan upgraded successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Cancel subscription ───────────────────────────────────────────────
    cancelSubscription = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.cancelSubscriptionUseCase.execute(
                req.user!.schoolId!,
                req.body,
            );
            sendSuccess(res, result, "Subscription cancelled successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Create subscription (super admin or internal) ─────────────────────
    createSubscription = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createSubscriptionUseCase.execute(
                req.body,
            );
            sendCreated(res, result, "Subscription created successfully");
        } catch (err) {
            next(err);
        }
    };


    getAllSubscriptions = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getAllSubscriptionsUseCase.execute({
                page:   Number(req.query.page)  || 1,
                limit:  Number(req.query.limit) || 20,
                status: req.query.status        as string | undefined,
                planId: req.query.planId        as string | undefined,
            });
            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };

    getSubscriptionBySchool = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getSubscriptionBySchoolUseCase.execute(
                req.params.schoolId as string,
            );
            sendSuccess(res, result, "Subscription retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    deactivateSubscription = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.deactivateSubscriptionUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Subscription deactivated successfully");
        } catch (err) {
            next(err);
        }
    };
}