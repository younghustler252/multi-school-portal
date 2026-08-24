import { Router }               from "express";
import { container }            from "../../../container";
import { SuperAdminController } from "../controllers/super-admin.controller";
import { validate }             from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }         from "../../../infrastructure/middleware/auth.middleware";
import { requireSuperAdmin }    from "../../../infrastructure/middleware/rbac.middleware";
import { ListUsersDto }         from "../dtos/super-admin.dto";

const router = Router();

const ctrl = () => container.resolve<SuperAdminController>(
    "superAdminController",
);

// All super admin routes require super_admin role
router.use(authenticate, requireSuperAdmin);

// ── Platform stats ────────────────────────────────────────────────────────
console.log("am being hit, ouch!!");

router.get(
    "/stats",
    (req, res, next) => ctrl().getPlatformStats(req, res, next),
);

// ── MRR trend ─────────────────────────────────────────────────────────────
router.get(
    "/stats/mrr-trend",
    (req, res, next) => ctrl().getMrrTrend(req, res, next),
);

// ── All users ─────────────────────────────────────────────────────────────
router.get(
    "/users",
    validate(ListUsersDto, "query"),
    (req, res, next) => ctrl().getAllUsers(req, res, next),
);

// ── Deactivate user ───────────────────────────────────────────────────────
router.delete(
    "/users/:userId",
    (req, res, next) => ctrl().deactivateUser(req, res, next),
);

// ── Impersonate school admin ──────────────────────────────────────────────
router.post(
    "/schools/:schoolId/impersonate",
    (req, res, next) => ctrl().impersonateSchool(req, res, next),
);

export default router;