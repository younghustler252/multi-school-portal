import { Router } from "express";
import { container } from "../../../container";
import { PlanController } from "../controllers/plan.controller";

/*
| PUBLIC PLAN ROUTES (mounted at /plans): the pricing page. No login.
| Everything that edits plans is in plan.platform.routes.ts under /platform/plans.
*/
const router = Router();
const ctrl   = () => container.resolve<PlanController>("planController");

router.get("/",    (q, s, n) => ctrl().getPlans(q, s, n));
router.get("/:id", (q, s, n) => ctrl().getPlanById(q, s, n));

export default router;
