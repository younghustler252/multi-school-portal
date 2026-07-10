import { Router }                from "express";
import { container }             from "../../../container";
import { EnrolmentController }   from "../controllers/enrolment.controller";
import { validate }              from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }          from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                                from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }         from "../../../infrastructure/middleware/tenant-resolver.middleware";
import {
    EnrolStudentDto,
    BulkEnrolDto,
    UpdateEnrolmentDto,
    ListEnrolmentsDto,
}                                from "../dtos/enrolment.dto";

/*
|--------------------------------------------------------------------------
| ENROLMENT ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<EnrolmentController>(
    "enrolmentController",
);

// ── List enrolments ───────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListEnrolmentsDto, "query"),
    (req, res, next) => ctrl().getEnrolments(req, res, next),
);

// ── Enrol single student ──────────────────────────────────────────────────
router.post(
    "/",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(EnrolStudentDto),
    (req, res, next) => ctrl().enrolStudent(req, res, next),
);

// ── Bulk enrol ────────────────────────────────────────────────────────────
router.post(
    "/bulk",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(BulkEnrolDto),
    (req, res, next) => ctrl().bulkEnrol(req, res, next),
);

// ── Update enrolment status ───────────────────────────────────────────────
router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(UpdateEnrolmentDto),
    (req, res, next) => ctrl().updateEnrolment(req, res, next),
);

export default router;