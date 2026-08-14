import { Router }              from "express";
import { container }           from "../../../container";
import { StaffController }     from "../controllers/staff.controller";
import { validate }            from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }        from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                              from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }       from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePlanLimit }    from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    CreateStaffDto,
    UpdateStaffDto,
    ListStaffDto,
}                              from "../dtos/staff.dto";

/*
|--------------------------------------------------------------------------
| STAFF ROUTES
| All routes require tenant context (school subdomain)
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<StaffController>("staffController");

// ── List all staff ────────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListStaffDto, "query"),
    (req, res, next) => ctrl().listStaff(req, res, next),
);

// ── Get authenticated staff member's classes ─────────────────────────────
router.get(
    "/me/classes",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getMyClasses(req, res, next),
);

// ── Get single staff member ───────────────────────────────────────────────
router.get(
    "/:id",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getStaff(req, res, next),
);

// ── Create staff member ───────────────────────────────────────────────────
router.post(
    "/",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requirePlanLimit("staff"),
    validate(CreateStaffDto),
    (req, res, next) => ctrl().createStaff(req, res, next),
);

// ── Update staff member ───────────────────────────────────────────────────
router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(UpdateStaffDto),
    (req, res, next) => ctrl().updateStaff(req, res, next),
);

// ── Deactivate staff member ───────────────────────────────────────────────
router.delete(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().deactivateStaff(req, res, next),
);

// ── Reactivate staff member ───────────────────────────────────────────────
router.post(
    "/:id/reactivate",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().reactivateStaff(req, res, next),
);

// ── Get staff assignments ─────────────────────────────────────────────────
router.get(
    "/:id/assignments",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getStaffAssignments(req, res, next),
);

export default router;
