import { Router } from "express";
import { container } from "../../../container";
import { TransferController } from "../controllers/transfer.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { StartTransfersDto, RetryTransferDto, ReconcileTransfersDto } from "../dtos/transfer.dto";
import { z } from "zod";

/*
| SALARY TRANSFER ROUTES (school realm, mounted at /payroll/transfers; plan feature modules.payroll).
| Everything is off until the platform AND the school's finance settings switch transfers on.
|   GET  /                       payroll.runs.view            ?status&runId&page&limit
|   GET  /runs/:runId            payroll.runs.view            the run's transfers with totals by status
|   POST /runs/:runId/start      payroll.transfers.send       { fromAccountId } create the pending transfers from the APPROVED run (nothing is sent)
|   POST /runs/:runId/send       payroll.transfers.send       send the pending ones, one by one
|   POST /reconcile              payroll.transfers.reconcile  { transferId? } ask the provider what happened to unsettled transfers
|   POST /:id/retry              payroll.transfers.send       { useCurrentBankDetails? } a new attempt for a failed or reversed transfer
|   POST /:id/cancel             payroll.transfers.send       stop a transfer that was not sent
*/
const router = Router();
const ctrl = () => container.resolve<TransferController>("transferController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.payroll")] as const;
const NoBody = z.object({}).strict();

router.get("/", ...guard("payroll.runs.view"), (q, s, n) => ctrl().list(q, s, n));
router.get("/runs/:runId", ...guard("payroll.runs.view"), (q, s, n) => ctrl().runTransfers(q, s, n));
router.post("/runs/:runId/start", ...guard("payroll.transfers.send"), validate(StartTransfersDto), (q, s, n) => ctrl().start(q, s, n));
router.post("/runs/:runId/send", ...guard("payroll.transfers.send"), validate(NoBody), (q, s, n) => ctrl().send(q, s, n));
router.post("/reconcile", ...guard("payroll.transfers.reconcile"), validate(ReconcileTransfersDto), (q, s, n) => ctrl().reconcile(q, s, n));
router.post("/:id/retry", ...guard("payroll.transfers.send"), validate(RetryTransferDto), (q, s, n) => ctrl().retry(q, s, n));
router.post("/:id/cancel", ...guard("payroll.transfers.send"), validate(NoBody), (q, s, n) => ctrl().cancel(q, s, n));

export default router;
