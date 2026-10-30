import { Router } from "express";
import { container } from "../../../container";
import { AutomationController } from "../controllers/automation.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { UpdateAutomationDto } from "../dtos/automation.dto";

/*
| AUTOMATION ROUTES (school realm, mounted at /automations)
|   GET    /                 automation.view     every automatic message with its settings, last run and which channels the school may use
|   GET    /:id              automation.view     one, with its recent runs
|   PATCH  /:id              automation.manage   switch on/off, channels, time and numbers
|   POST   /:id/dry-run      automation.manage   find who would be messaged and show sample messages, sending nothing
|   POST   /:id/run          automation.manage   run it now (the same message is never sent twice to the same person)
|   GET    /:id/runs         automation.view     history
*/
const router = Router();
const ctrl = () => container.resolve<AutomationController>("automationController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;

router.get("/", ...guard("automation.view"), (q, s, n) => ctrl().list(q, s, n));
router.get("/:id", ...guard("automation.view"), (q, s, n) => ctrl().get(q, s, n));
router.patch("/:id", ...guard("automation.manage"), validate(UpdateAutomationDto), (q, s, n) => ctrl().update(q, s, n));
router.post("/:id/dry-run", ...guard("automation.manage"), (q, s, n) => ctrl().dryRun(q, s, n));
router.post("/:id/run", ...guard("automation.manage"), (q, s, n) => ctrl().run(q, s, n));
router.get("/:id/runs", ...guard("automation.view"), (q, s, n) => ctrl().runs(q, s, n));

export default router;
