import { Router } from "express";
import { container } from "../../../container";
import { FeeAdjustmentController } from "../controllers/fee-adjustment.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { RequestAdjustmentDto, ApproveAdjustmentDto, RejectAdjustmentDto } from "../dtos/adjustment.dto";

/*
| ADJUSTMENT ROUTES (school realm, mounted at /fees/adjustments). Every route: authenticate, tenant, permission, fees entitlement, validation.
|   GET  /               fees.invoices.view         (?status, ?type, ?invoiceId, ?studentId, ?page, ?limit)
|   POST /               fees.adjustments.request   waiver, write-off, credit note or extra discount on an issued invoice
|   GET  /:id            fees.invoices.view
|   POST /:id/approve    fees.adjustments.approve   by someone other than the person who asked; posts to the books
|   POST /:id/reject     fees.adjustments.approve
*/
const router = Router();
const ctrl = () => container.resolve<FeeAdjustmentController>("feeAdjustmentController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/", ...guard("fees.invoices.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...guard("fees.adjustments.request"), validate(RequestAdjustmentDto), (q, s, n) => ctrl().request(q, s, n));
router.get("/:id", ...guard("fees.invoices.view"), (q, s, n) => ctrl().get(q, s, n));
router.post("/:id/approve", ...guard("fees.adjustments.approve"), validate(ApproveAdjustmentDto), (q, s, n) => ctrl().approve(q, s, n));
router.post("/:id/reject", ...guard("fees.adjustments.approve"), validate(RejectAdjustmentDto), (q, s, n) => ctrl().reject(q, s, n));

export default router;
