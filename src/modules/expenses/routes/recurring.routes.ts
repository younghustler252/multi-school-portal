import { Router } from "express";
import { container } from "../../../container";
import { RecurringController } from "../controllers/recurring.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { CreateRecurringDto, UpdateRecurringDto } from "../dtos/recurring.dto";

/*
| RECURRING EXPENSE ROUTES (school realm, mounted at /recurring-expenses).
|   GET /  (?active, ?page, ?limit), GET /:id        expenses.view
|   POST /, PUT /:id, POST /:id/pause, /resume, DELETE /:id, POST /run   expenses.create
| Turning on autoApprove also needs expenses.approve (checked in the controller): it skips the approver.
*/
const router = Router();
const ctrl = () => container.resolve<RecurringController>("recurringController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.expenses")] as const;

router.get("/", ...guard("expenses.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...guard("expenses.create"), validate(CreateRecurringDto), (q, s, n) => ctrl().create(q, s, n));
router.post("/run", ...guard("expenses.create"), (q, s, n) => ctrl().runNow(q, s, n));
router.get("/:id", ...guard("expenses.view"), (q, s, n) => ctrl().get(q, s, n));
router.put("/:id", ...guard("expenses.create"), validate(UpdateRecurringDto), (q, s, n) => ctrl().update(q, s, n));
router.post("/:id/pause", ...guard("expenses.create"), (q, s, n) => ctrl().setActive(false)(q, s, n));
router.post("/:id/resume", ...guard("expenses.create"), (q, s, n) => ctrl().setActive(true)(q, s, n));
router.delete("/:id", ...guard("expenses.create"), (q, s, n) => ctrl().remove(q, s, n));

export default router;
