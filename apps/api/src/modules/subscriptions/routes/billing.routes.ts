import { Router } from "express";
import { container } from "../../../container";
import { BillingController } from "../controllers/billing.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { authLimiter } from "../../../infrastructure/middleware/rate-limit.middleware";
import { PreviewChangeDto, ChangePlanDto, RequestDowngradeDto, CancelSubscriptionDto, ToggleAutoRenewDto } from "../dtos/subscription.dto";

/*
| BILLING ROUTES (school realm, mounted at /billing on the school's host).
| view = see; manage = spend money or change the plan. Nothing here needs the school to be verified:
| a school must always be able to pay us.
*/
const router = Router();
const ctrl   = () => container.resolve<BillingController>("billingController");
const view   = [authenticate, requireTenant, requirePermission("billing.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("billing.manage")] as const;

router.get("/", ...view, (q, s, n) => ctrl().summary(q, s, n));
router.post("/preview", ...view, validate(PreviewChangeDto), (q, s, n) => ctrl().preview(q, s, n));
router.post("/change-plan", ...manage, authLimiter, validate(ChangePlanDto), (q, s, n) => ctrl().changePlan(q, s, n));
router.get("/verify", ...manage, (q, s, n) => ctrl().verify(q, s, n));

router.get("/invoices", ...view, (q, s, n) => ctrl().listInvoices(q, s, n));
router.get("/invoices/:id", ...view, (q, s, n) => ctrl().getInvoice(q, s, n));
router.post("/invoices/:id/pay", ...manage, authLimiter, (q, s, n) => ctrl().payInvoice(q, s, n));

router.post("/downgrade", ...manage, validate(RequestDowngradeDto), (q, s, n) => ctrl().requestDowngrade(q, s, n));
router.delete("/downgrade", ...manage, (q, s, n) => ctrl().cancelDowngrade(q, s, n));
router.post("/cancel", ...manage, validate(CancelSubscriptionDto), (q, s, n) => ctrl().cancel(q, s, n));
router.post("/resume", ...manage, (q, s, n) => ctrl().resume(q, s, n));
router.put("/auto-renew", ...manage, validate(ToggleAutoRenewDto), (q, s, n) => ctrl().autoRenew(q, s, n));

router.get("/payment-methods", ...view, (q, s, n) => ctrl().listMethods(q, s, n));
router.delete("/payment-methods/:id", ...manage, (q, s, n) => ctrl().removeMethod(q, s, n));

export default router;
