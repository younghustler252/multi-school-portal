import { Router } from "express";
import { container } from "../../../container";
import { PaymentController } from "../controllers/payment.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    RecordPaymentDto, ConfirmPaymentDto, RejectPaymentDto, AllocationPreviewDto, ApplyCreditDto, RequestRefundDto, ApproveRefundDto, RejectRefundDto, PayRefundDto, ReversePaymentDto,
} from "../dtos/payment.dto";

/*
| PAYMENT ROUTES (school realm, mounted at /payments). Every route: authenticate, tenant, permission, fees entitlement, validation.
|   GET  /                       payments.view     (?status, ?method, ?guardianId, ?studentId, ?branchId, ?from, ?to, ?page, ?limit)
|   POST /                       payments.record   cash and POS are confirmed at once; transfers and cheques wait for a second person
|   POST /allocation-preview     payments.record   how an amount would be applied, nothing saved
|   GET  /credit/:studentId       payments.view     the credit a student holds
|   POST /credit/apply            payments.record   use a student's credit on one of their open invoices
|   GET  /refunds                 payments.view     (?status, ?paymentId, ?studentId, ?page, ?limit)
|   POST /refunds                 payments.refund.request   pay credit back: asked for here
|   GET  /refunds/:id             payments.view
|   POST /refunds/:id/approve     payments.refund.approve   by someone other than the person who asked
|   POST /refunds/:id/reject      payments.refund.approve
|   POST /refunds/:id/pay         payments.refund.approve   the money leaves a money account
|   GET  /:id                    payments.view     with its allocations
|   GET  /:id/receipt            payments.view     the receipt as issued
|   POST /:id/confirm            payments.confirm  by someone other than the recorder
|   POST /:id/reject             payments.confirm
|   POST /:id/reverse            payments.reverse  undo a confirmed payment (not when it has refunds)
*/
const router = Router();
const ctrl = () => container.resolve<PaymentController>("paymentController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/", ...guard("payments.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...guard("payments.record"), validate(RecordPaymentDto), (q, s, n) => ctrl().record(q, s, n));
router.post("/allocation-preview", ...guard("payments.record"), validate(AllocationPreviewDto), (q, s, n) => ctrl().preview(q, s, n));
router.get("/credit/:studentId", ...guard("payments.view"), (q, s, n) => ctrl().credit(q, s, n));
router.post("/credit/apply", ...guard("payments.record"), validate(ApplyCreditDto), (q, s, n) => ctrl().applyCredit(q, s, n));
router.get("/refunds", ...guard("payments.view"), (q, s, n) => ctrl().listRefunds(q, s, n));
router.post("/refunds", ...guard("payments.refund.request"), validate(RequestRefundDto), (q, s, n) => ctrl().requestRefund(q, s, n));
router.get("/refunds/:id", ...guard("payments.view"), (q, s, n) => ctrl().getRefund(q, s, n));
router.post("/refunds/:id/approve", ...guard("payments.refund.approve"), validate(ApproveRefundDto), (q, s, n) => ctrl().approveRefund(q, s, n));
router.post("/refunds/:id/reject", ...guard("payments.refund.approve"), validate(RejectRefundDto), (q, s, n) => ctrl().rejectRefund(q, s, n));
router.post("/refunds/:id/pay", ...guard("payments.refund.approve"), validate(PayRefundDto), (q, s, n) => ctrl().payRefund(q, s, n));
router.get("/:id", ...guard("payments.view"), (q, s, n) => ctrl().get(q, s, n));
router.get("/:id/receipt", ...guard("payments.view"), (q, s, n) => ctrl().receipt(q, s, n));
router.post("/:id/confirm", ...guard("payments.confirm"), validate(ConfirmPaymentDto), (q, s, n) => ctrl().confirm(q, s, n));
router.post("/:id/reject", ...guard("payments.confirm"), validate(RejectPaymentDto), (q, s, n) => ctrl().reject(q, s, n));
router.post("/:id/reverse", ...guard("payments.reverse"), validate(ReversePaymentDto), (q, s, n) => ctrl().reverse(q, s, n));

export default router;
