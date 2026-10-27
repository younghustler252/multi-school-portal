import { Router } from "express";
import { container } from "../../../container";
import { SettlementController } from "../controllers/settlement.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { SettlementReportDto, SettlePaymentsDto, ReverseSettlementDto } from "../dtos/settlement.dto";

/*
| GATEWAY SETTLEMENT ROUTES (school realm, mounted at /finance/settlements). Plan feature modules.fees, like the payments they settle.
|   GET  /unsettled        payments.view    confirmed online payments not paid out yet, with the clearing account control
|   GET  /                 payments.view    settlements recorded
|   GET  /:id              payments.view    one settlement with the payments it paid out
|   POST /report/preview   payments.settle  check a Paystack settlement report (CSV text); changes nothing
|   POST /report           payments.settle  record every clean settlement in the report; the rest are reported back
|   POST /                 payments.settle  settle chosen payments by hand
|   POST /:id/reverse      payments.settle  needs a written reason; the payments become unsettled again
*/
const router = Router();
const ctrl = () => container.resolve<SettlementController>("settlementController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/unsettled", ...guard("payments.view"), (q, s, n) => ctrl().unsettled(q, s, n));
router.get("/", ...guard("payments.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/report/preview", ...guard("payments.settle"), validate(SettlementReportDto), (q, s, n) => ctrl().preview(q, s, n));
router.post("/report", ...guard("payments.settle"), validate(SettlementReportDto), (q, s, n) => ctrl().recordReport(q, s, n));
router.post("/", ...guard("payments.settle"), validate(SettlePaymentsDto), (q, s, n) => ctrl().settlePayments(q, s, n));
router.get("/:id", ...guard("payments.view"), (q, s, n) => ctrl().get(q, s, n));
router.post("/:id/reverse", ...guard("payments.settle"), validate(ReverseSettlementDto), (q, s, n) => ctrl().reverse(q, s, n));

export default router;
