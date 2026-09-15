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
    GetBillingHistoryDto,
    RequestDowngradeDto,
    ToggleAutoRenewDto,
} from "../dtos/subscription.dto";

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

// Cancel subscription
router.delete(
    "/me",
    authenticate,
    requireSchoolAdmin,
    validate(CancelSubscriptionDto),
    (req, res, next) => ctrl().cancelSubscription(req, res, next),
);

// Initiate subscription upgrade
router.put(
    "/me/upgrade",
    authenticate,
    requireSchoolAdmin,
    validate(UpgradePlanDto),
    (req, res, next) => ctrl().initiateSubscriptionUpgrade(req, res, next),
);

// Verify subscription upgrade payment
router.get(
    "/me/upgrade/verify",
    authenticate,
    requireSchoolAdmin,
    (req, res, next) => ctrl().verifySubscriptionUpgrade(req, res, next),
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

router.get(
    "/billing-history",
    authenticate,
    requireSchoolAdmin,
    // validate(GetBillingHistoryDto),
    (req, res, next) => ctrl().getMyBillingHistory(req, res, next),
);

// Toggle subscription auto-renew
router.put(
    "/auto-renew",
    authenticate,
    requireSchoolAdmin,
    validate(ToggleAutoRenewDto),
    (req, res, next) => ctrl().toggleAutoRenew(req, res, next),
);

router.put(
    "/downgrade",
    authenticate,
    requireSchoolAdmin,
    validate(RequestDowngradeDto),
    (req, res, next) => ctrl().requestDowngrade(req, res, next),
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
