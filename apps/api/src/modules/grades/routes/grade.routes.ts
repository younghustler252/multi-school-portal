import { Router }             from "express";
import { container }          from "../../../container";
import { GradeController }    from "../controllers/grade.controller";
import { validate }           from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }       from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                             from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }      from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requireFeature }     from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    EnterGradeDto,
    BulkEnterGradesDto,
    UpdateGradeDto,
    PublishGradesDto,
    ListGradesDto,
    UpdateGradingConfigDto,
}                             from "../dtos/grade.dto";

/*
|--------------------------------------------------------------------------
| GRADE ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<GradeController>("gradeController");

// ── Get grades ────────────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListGradesDto, "query"),
    (req, res, next) => ctrl().getGrades(req, res, next),
);
// ── Get my children's grades ─────────────────────────────────────────────
router.get(
    "/my-children",
    authenticate,
    requireTenant,
    (req, res, next) => ctrl().getMyChildrenGrades(req, res, next),
);

// ── Enter single grade ────────────────────────────────────────────────────
router.post(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(EnterGradeDto),
    (req, res, next) => ctrl().enterGrade(req, res, next),
);

// ── Bulk enter grades ─────────────────────────────────────────────────────
router.post(
    "/bulk",
    authenticate,
    requireTenant,
    requireStaff,
    validate(BulkEnterGradesDto),
    (req, res, next) => ctrl().bulkEnterGrades(req, res, next),
);

// ── Update grade ──────────────────────────────────────────────────────────
router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireStaff,
    validate(UpdateGradeDto),
    (req, res, next) => ctrl().updateGrade(req, res, next),
);

// ── Publish grades ────────────────────────────────────────────────────────
router.post(
    "/publish",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(PublishGradesDto),
    (req, res, next) => ctrl().publishGrades(req, res, next),
);

// ── Get grading config ────────────────────────────────────────────────────
router.get(
    "/config",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getGradingConfig(req, res, next),
);

// ── Update grading config (Pro plan only) ─────────────────────────────────
router.put(
    "/config",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requireFeature("customGrading"),
    validate(UpdateGradingConfigDto),
    (req, res, next) => ctrl().updateGradingConfig(req, res, next),
);

export default router;