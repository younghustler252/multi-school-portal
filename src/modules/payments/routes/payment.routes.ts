import { Router }              from "express";
import { container }           from "../../../container";
import { PaymentController }   from "../controllers/payment.controller";
import { validate }            from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }        from "../../../infrastructure/middleware/auth.middleware";
import { requireStaff }        from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }       from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requireFeature }      from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    InitializePaymentDto,
    ListPaymentsDto,
}                              from "../dtos/payment.dto";

const router = Router();
const ctrl   = () => container.resolve<PaymentController>("paymentController");

// ── Paystack webhook — no auth, raw body needed ───────────────────────────
router.post(
    "/webhook/paystack",
    (req, res, next) => ctrl().handleWebhook(req, res, next),
);

// ── List payments ─────────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListPaymentsDto, "query"),
    (req, res, next) => ctrl().getPayments(req, res, next),
);

// ── Initialize online payment ─────────────────────────────────────────────
router.post(
    "/initialize",
    authenticate,
    requireTenant,
    requireFeature("paymentCollection"),
    validate(InitializePaymentDto),
    (req, res, next) => ctrl().initializePayment(req, res, next),
);

// ── Verify payment after Paystack redirect ────────────────────────────────
router.get(
    "/verify/:reference",
    authenticate,
    requireTenant,
    (req, res, next) => ctrl().verifyPayment(req, res, next),
);

export default router;