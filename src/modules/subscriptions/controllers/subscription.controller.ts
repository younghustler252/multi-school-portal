import { Request, Response, NextFunction } from "express";
import { CreateSubscriptionUseCase }  from "../usecases/super-admin/create-subscription.usecase";
import { GetSubscriptionUseCase }     from "../usecases/school-admin/get-subscription.usecase";
import { InitiateSubscriptionUpgradeUseCase } from "../usecases/school-admin/initiate-upgrade-subscription.usecase";
import { VerifySubscriptionUpgradeUseCase} from "../usecases/school-admin/verify-subscription-upgrade";
import { CancelSubscriptionUseCase }  from "../usecases/school-admin/cancel-subscription.usecase";
import { RequestDowngradeUseCase } from "../usecases/school-admin/request-downgrade.usecase";
import { GetMyBillingHistoryUseCase } from "../usecases/school-admin/get-my-billing-history.ysecase";

import { GetAllSubscriptionsUseCase }      from "../usecases/super-admin/get-all-subscriptions.usecase";
import { GetSubscriptionBySchoolUseCase }  from "../usecases/super-admin/get-subscription-by-school.usecase";
import { DeactivateSubscriptionUseCase }   from "../usecases/super-admin/deactivate-subscription.usecase";
import { ToggleSubscriptionAutoRenewUseCase } from "../usecases/school-admin/toggle-subscription-auto-renew"
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
    getSubscriptionUseCase: GetSubscriptionUseCase;
    cancelSubscriptionUseCase: CancelSubscriptionUseCase;
    getMyBillingHistoryUseCase: GetMyBillingHistoryUseCase; 
    requestDowngradeUseCase: RequestDowngradeUseCase;
   
    getAllSubscriptionsUseCase: GetAllSubscriptionsUseCase;
    getSubscriptionBySchoolUseCase: GetSubscriptionBySchoolUseCase;
    deactivateSubscriptionUseCase: DeactivateSubscriptionUseCase;
    initiateSubscriptionUpgradeUseCase: InitiateSubscriptionUpgradeUseCase;
    verifySubscriptionUpgradeUseCase: VerifySubscriptionUpgradeUseCase;
    toggleSubscriptionAutoRenewUseCase: ToggleSubscriptionAutoRenewUseCase;

}

export class SubscriptionController {
    private readonly createSubscriptionUseCase: CreateSubscriptionUseCase;
    private readonly getSubscriptionUseCase: GetSubscriptionUseCase;
    private readonly cancelSubscriptionUseCase: CancelSubscriptionUseCase;
    private readonly getMyBillingHistoryUseCase: GetMyBillingHistoryUseCase; 
    private readonly requestDowngradeUseCase: RequestDowngradeUseCase;
    private readonly getAllSubscriptionsUseCase: GetAllSubscriptionsUseCase;
    private readonly getSubscriptionBySchoolUseCase: GetSubscriptionBySchoolUseCase;
    private readonly deactivateSubscriptionUseCase: DeactivateSubscriptionUseCase;
    private readonly initiateSubscriptionUpgradeUseCase: InitiateSubscriptionUpgradeUseCase;
    private readonly verifySubscriptionUpgradeUseCase: VerifySubscriptionUpgradeUseCase;
    private readonly toggleSubscriptionAutoRenewUseCase: ToggleSubscriptionAutoRenewUseCase;

    constructor({
        createSubscriptionUseCase,
        getSubscriptionUseCase,
        cancelSubscriptionUseCase,
        getMyBillingHistoryUseCase, 
        requestDowngradeUseCase,

        getAllSubscriptionsUseCase,
        getSubscriptionBySchoolUseCase,
        deactivateSubscriptionUseCase,
        initiateSubscriptionUpgradeUseCase,
        verifySubscriptionUpgradeUseCase,
        toggleSubscriptionAutoRenewUseCase,
        
    }: Dependencies) {
        this.createSubscriptionUseCase = createSubscriptionUseCase;
        this.getSubscriptionUseCase = getSubscriptionUseCase;
        this.cancelSubscriptionUseCase = cancelSubscriptionUseCase;
        this.getMyBillingHistoryUseCase = getMyBillingHistoryUseCase; 
        this.requestDowngradeUseCase = requestDowngradeUseCase;

        this.getAllSubscriptionsUseCase = getAllSubscriptionsUseCase;
        this.getSubscriptionBySchoolUseCase = getSubscriptionBySchoolUseCase;
        this.deactivateSubscriptionUseCase = deactivateSubscriptionUseCase;
        this.initiateSubscriptionUpgradeUseCase = initiateSubscriptionUpgradeUseCase;
        this.verifySubscriptionUpgradeUseCase = verifySubscriptionUpgradeUseCase;
        this.toggleSubscriptionAutoRenewUseCase = toggleSubscriptionAutoRenewUseCase;
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

     // ── Initiate subscription upgrade ─────────────────────────────────────
    initiateSubscriptionUpgrade = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const schoolId = req.user?.schoolId;
            const userId = req.user?.id;

            if (!schoolId || !userId) {
                res.status(400).json({
                    success: false,
                    message: "This endpoint is only available to school users",
                });
                return;
            }

            const result =
                await this.initiateSubscriptionUpgradeUseCase.execute(
                    schoolId,
                    userId,
                    req.body,
                );

            sendSuccess(
                res,
                result,
                "Subscription upgrade payment initialized successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    // ── Verify subscription upgrade ───────────────────────────────────────
    verifySubscriptionUpgrade = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const reference =
                req.body?.reference ??
                req.query.reference;


            if (!reference || typeof reference !== "string") {
                res.status(400).json({
                    success: false,
                    message: "Payment reference is required",
                });
                return;
            }

            const result =
                await this.verifySubscriptionUpgradeUseCase.execute(
                    reference,
                );

            sendSuccess(
                res,
                result,
                "Subscription upgrade payment verified successfully",
            );
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
                // planId: req.query.planId        as string | undefined,
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

    toggleAutoRenew = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result =
                await this.toggleSubscriptionAutoRenewUseCase.execute(
                    req.user!.schoolId!,
                    req.body,
                );
            sendSuccess( res, result,`Subscription auto-renew ${result.autoRenew ? "enabled" : "disabled"} successfully`,);
        } catch (err) {
            next(err);
        }
    };

    // ── Get own billing history ────────────────────────────────────────────
    getMyBillingHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const schoolId = req.user?.schoolId;
            if (!schoolId) {
                res.status(400).json({ success: false, message: "This endpoint is only available to school users" });
                return;
            }

            const result = await this.getMyBillingHistoryUseCase.execute(schoolId, {
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
            });

            sendSuccess(res, result, "Billing history retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Request subscription downgrade ────────────────────────────────────
    requestDowngrade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const schoolId = req.user?.schoolId;
            if (!schoolId) {
                res.status(400).json({ success: false, message: "This endpoint is only available to school users" });
                return;
            }

            const result = await this.requestDowngradeUseCase.execute(schoolId, req.body.newPlanId);
            sendSuccess(res, result, "Subscription downgrade scheduled successfully");
        } catch (err) {
            next(err);
        }
    };

}