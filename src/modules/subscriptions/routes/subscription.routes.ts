import { Router }                  from "express";
import { container }               from "../../../container";
import { SubscriptionController }  from "../controllers/subscription.controller";
import { validate }                from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }            from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireSuperAdmin,
}                                  from "../../../infrastructure/middleware/rbac.middleware";
import {
    UpgradePlanDto,
    CancelSubscriptionDto,
    CreateSubscriptionDto,
}                                  from "../dtos/subscription.dto";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<SubscriptionController>(
    "subscriptionController",
);

// ── School admin routes ───────────────────────────────────────────────────

// Get own subscription + plan details
router.get(
    "/me",
    authenticate,
    requireSchoolAdmin,
    (req, res, next) => ctrl().getMySubscription(req, res, next),
);

// Upgrade plan
router.put(
    "/me/upgrade",
    authenticate,
    requireSchoolAdmin,
    validate(UpgradePlanDto),
    (req, res, next) => ctrl().upgradePlan(req, res, next),
);

// Cancel subscription
router.delete(
    "/me",
    authenticate,
    requireSchoolAdmin,
    validate(CancelSubscriptionDto),
    (req, res, next) => ctrl().cancelSubscription(req, res, next),
);

// ── Super admin routes ────────────────────────────────────────────────────

// Create subscription for a school
router.post(
    "/",
    authenticate,
    requireSuperAdmin,
    validate(CreateSubscriptionDto),
    (req, res, next) => ctrl().createSubscription(req, res, next),
);

// Get all subscriptions — super admin
router.get(
    "/",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().getAllSubscriptions(req, res, next),
);

// Get subscription by school ID — super admin
router.get(
    "/school/:schoolId",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().getSubscriptionBySchool(req, res, next),
);

// Deactivate subscription — super admin
router.put(
    "/:id/deactivate",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().deactivateSubscription(req, res, next),
);

export default router;