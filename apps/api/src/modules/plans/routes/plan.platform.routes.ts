import { Router } from "express";
import { container } from "../../../container";
import { PlanPlatformController } from "../controllers/plan-platform.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { CreatePlanDto, UpdatePlanDto, SetEntitlementsDto, ClonePlanDto } from "../dtos/plan.dto";

/* PLATFORM PLAN ROUTES (mounted at /platform/plans, admin host). */
const router = Router();
const ctrl   = () => container.resolve<PlanPlatformController>("planPlatformController");

router.get("/",  authenticate, requirePermission("platform.plans.view"),   (q, s, n) => ctrl().list(q, s, n));
router.post("/", authenticate, requirePermission("platform.plans.manage"), validate(CreatePlanDto), (q, s, n) => ctrl().create(q, s, n));

router.get("/:id",              authenticate, requirePermission("platform.plans.view"),   (q, s, n) => ctrl().get(q, s, n));
router.put("/:id",              authenticate, requirePermission("platform.plans.manage"), validate(UpdatePlanDto), (q, s, n) => ctrl().update(q, s, n));
router.put("/:id/entitlements", authenticate, requirePermission("platform.plans.manage"), validate(SetEntitlementsDto), (q, s, n) => ctrl().setEntitlements(q, s, n));
router.put("/:id/deactivate",   authenticate, requirePermission("platform.plans.manage"), (q, s, n) => ctrl().deactivate(q, s, n));
router.put("/:id/reactivate",   authenticate, requirePermission("platform.plans.manage"), (q, s, n) => ctrl().reactivate(q, s, n));
router.post("/:id/clone",       authenticate, requirePermission("platform.plans.manage"), validate(ClonePlanDto), (q, s, n) => ctrl().clone(q, s, n));

export default router;
