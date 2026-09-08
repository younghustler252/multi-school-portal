import { Router }              from "express";
import { container }           from "../../../container";
import { PaymentController }   from "../controllers/payment.controller";

import { webhookLimiter }      from "../../../infrastructure/middleware/rate-limit.middleware";
import { validate }            from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }        from "../../../infrastructure/middleware/auth.middleware";
import { requireStaff }        from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }       from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requireFeature }      from "../../../infrastructure/middleware/feature-gate.middleware";

import {
    InitializePaymentDto,
    ListPaymentsDto,
} from "../dtos/payment.dto";

const router = Router();

const ctrl = () =>
    container.resolve<PaymentController>("paymentController");


// ── Paystack webhook — no auth ────────────────────────────────────────────
router.post(
    "/webhook/paystack",
    webhookLimiter,
    (req, res, next) =>
        ctrl().handleWebhook(req, res, next),
);


// ── Get my payments ───────────────────────────────────────────────────────
router.get(
    "/my-payments",
    authenticate,
    requireTenant,
    validate(ListPaymentsDto, "query"),
    (req, res, next) =>
        ctrl().getMyPayments(req, res, next),
);


// ── List payments ─────────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListPaymentsDto, "query"),
    (req, res, next) =>
        ctrl().getPayments(req, res, next),
);


// ── Initialize online payment ─────────────────────────────────────────────
router.post(
    "/initialize",
    authenticate,
    requireTenant,
    requireFeature("paymentCollection"),
    validate(InitializePaymentDto),
    (req, res, next) =>
        ctrl().initializePayment(req, res, next),
);


// ── Verify payment after Paystack redirect ────────────────────────────────
router.get(
    "/verify/:reference",
    authenticate,
    requireTenant,
    (req, res, next) =>
        ctrl().verifyPayment(req, res, next),
);
// console.log("REGISTERING PAYMENT /banks ROUTE");


// ── List Nigerian banks ───────────────────────────────────────────────────
router.get(
    "/banks",
    authenticate,
    // requireTenant,
    (req, res, next) => {

        ctrl().listBanks(req, res, next);
    },
);

// ── Verify bank account ───────────────────────────────────────────────────
// Resolves account number → account name through Paystack
router.post(
    "/verify-bank-account",
    authenticate,
    // requireTenant,
    (req, res, next) =>
        ctrl().verifyBankAccount(req, res, next),
);


export default router;