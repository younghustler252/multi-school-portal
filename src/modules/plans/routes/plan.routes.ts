import { Router }          from "express";
import { container }       from "../../../container";
import { PlanController }  from "../controllers/plan.controller";
import { validate }        from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }    from "../../../infrastructure/middleware/auth.middleware";
import { requireSuperAdmin } from "../../../infrastructure/middleware/rbac.middleware";
import { optionalAuthenticate } from "../../../infrastructure/middleware/auth.middleware";
import {
    CreatePlanDto,
    UpdatePlanDto,
}                          from "../dtos/plan.dto";

/*
|--------------------------------------------------------------------------
| PLAN ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<PlanController>("planController");

// ── Public — anyone can view plans (for signup page) ─────────────────────
router.get(
    "/",
    optionalAuthenticate,
    (req, res, next) => ctrl().getPlans(req, res, next),
);

// ── Super admin only ──────────────────────────────────────────────────────
router.post(
    "/",
    authenticate,
    requireSuperAdmin,
    validate(CreatePlanDto),
    (req, res, next) => ctrl().createPlan(req, res, next),
);

router.put(
    "/:id",
    authenticate,
    requireSuperAdmin,
    validate(UpdatePlanDto),
    (req, res, next) => ctrl().updatePlan(req, res, next),
);
// Get plan by ID — public
router.get(
    "/:id",
    optionalAuthenticate,
    (req, res, next) => ctrl().getPlanById(req, res, next),
);

// Delete plan — super admin
router.delete(
    "/:id",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().deletePlan(req, res, next),
);

router.post(
    "/seed",
    authenticate,
    requireSuperAdmin,
    (req, res, next) => ctrl().seedPlans(req, res, next),
);

export default router;