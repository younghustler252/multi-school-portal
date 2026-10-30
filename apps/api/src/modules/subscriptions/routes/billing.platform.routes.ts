import { Router } from "express";
import { container } from "../../../container";
import { BillingPlatformController } from "../controllers/billing-platform.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { PlatformChangePlanDto, ExtendPeriodDto, VoidInvoiceDto, MarkInvoicePaidDto } from "../dtos/subscription.dto";

/* PLATFORM BILLING ROUTES (mounted at /platform/subscriptions, admin host). Fixed paths come before "/:schoolId". */
const router = Router();
const ctrl   = () => container.resolve<BillingPlatformController>("billingPlatformController");

router.get("/",         authenticate, requirePermission("platform.subscriptions.view"), (q, s, n) => ctrl().list(q, s, n));
router.get("/stats",    authenticate, requirePermission("platform.subscriptions.view"), (q, s, n) => ctrl().stats(q, s, n));
router.get("/invoices", authenticate, requirePermission("platform.subscriptions.view"), (q, s, n) => ctrl().listInvoices(q, s, n));
router.put("/invoices/:id/void",      authenticate, requirePermission("platform.subscriptions.manage"), validate(VoidInvoiceDto), (q, s, n) => ctrl().voidInvoice(q, s, n));
router.put("/invoices/:id/mark-paid", authenticate, requirePermission("platform.subscriptions.manage"), validate(MarkInvoicePaidDto), (q, s, n) => ctrl().markPaid(q, s, n));

router.get("/:schoolId",        authenticate, requirePermission("platform.subscriptions.view"),   (q, s, n) => ctrl().get(q, s, n));
router.put("/:schoolId/plan",   authenticate, requirePermission("platform.subscriptions.manage"), validate(PlatformChangePlanDto), (q, s, n) => ctrl().changePlan(q, s, n));
router.put("/:schoolId/extend", authenticate, requirePermission("platform.subscriptions.manage"), validate(ExtendPeriodDto), (q, s, n) => ctrl().extend(q, s, n));

export default router;
