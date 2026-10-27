import { Router } from "express";
import { container } from "../../../container";
import { FinanceSettingsController } from "../controllers/finance-settings.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { UpdateFinanceSettingsDto } from "../dtos/finance-settings.dto";

/*
| FINANCE SETTINGS ROUTES (school realm, mounted at /finance/settings). No plan feature is needed: every school has them.
|   GET /   finance.settings.view     every setting with its effective value, default and whether the school changed it
|   PUT /   finance.settings.manage   { values: { key: value | null } }  null restores the default
*/
const router = Router();
const ctrl = () => container.resolve<FinanceSettingsController>("financeSettingsController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;

router.get("/", ...guard("finance.settings.view"), (q, s, n) => ctrl().get(q, s, n));
router.put("/", ...guard("finance.settings.manage"), validate(UpdateFinanceSettingsDto), (q, s, n) => ctrl().update(q, s, n));

export default router;
