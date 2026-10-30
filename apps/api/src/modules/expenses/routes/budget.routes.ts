import { Router } from "express";
import { container } from "../../../container";
import { BudgetController } from "../controllers/budget.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { CreateBudgetDto, UpdateBudgetDto, SetBudgetLinesDto } from "../dtos/budget.dto";

/*
| BUDGET ROUTES (school realm, mounted at /budgets; needs the finance.budgets entitlement).
|   GET /  (?status, ?page, ?limit), GET /:id, GET /:id/vs-actual (?asOf)   budgets.view
|   POST /, PUT /:id, PUT /:id/lines, POST /:id/activate, POST /:id/close, DELETE /:id (drafts only)   budgets.manage
*/
const router = Router();
const ctrl = () => container.resolve<BudgetController>("budgetController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("finance.budgets")] as const;

router.get("/", ...guard("budgets.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...guard("budgets.manage"), validate(CreateBudgetDto), (q, s, n) => ctrl().create(q, s, n));
router.get("/:id", ...guard("budgets.view"), (q, s, n) => ctrl().get(q, s, n));
router.get("/:id/vs-actual", ...guard("budgets.view"), (q, s, n) => ctrl().vsActual(q, s, n));
router.put("/:id", ...guard("budgets.manage"), validate(UpdateBudgetDto), (q, s, n) => ctrl().update(q, s, n));
router.put("/:id/lines", ...guard("budgets.manage"), validate(SetBudgetLinesDto), (q, s, n) => ctrl().setLines(q, s, n));
router.post("/:id/activate", ...guard("budgets.manage"), (q, s, n) => ctrl().setStatus("ACTIVE")(q, s, n));
router.post("/:id/close", ...guard("budgets.manage"), (q, s, n) => ctrl().setStatus("CLOSED")(q, s, n));
router.delete("/:id", ...guard("budgets.manage"), (q, s, n) => ctrl().remove(q, s, n));

export default router;
