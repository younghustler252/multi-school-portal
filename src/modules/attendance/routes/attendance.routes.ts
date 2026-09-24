import { Router }                 from "express";
import { container }              from "../../../container";
import { AttendanceController }   from "../controllers/attendance.controller";
import { validate }               from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }           from "../../../infrastructure/middleware/auth.middleware";
import {
    requireStaff,
    requireSchoolAdmin,
}                                 from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }          from "../../../infrastructure/middleware/tenant-resolver.middleware";
import {
    MarkAttendanceDto,
    BulkMarkAttendanceDto,
    UpdateAttendanceDto,
    ListAttendanceDto,
}                                 from "../dtos/attendance.dto";

/*
|--------------------------------------------------------------------------
| ATTENDANCE ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<AttendanceController>(
    "attendanceController",
);

// ── Get attendance records ────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListAttendanceDto, "query"),
    (req, res, next) => ctrl().getAttendance(req, res, next),
);


// ── Get my children's attendance ─────────────────────────────────────────
router.get(
    "/my-children",
    authenticate,
    requireTenant,
    (req, res, next) => ctrl().getMyChildrenAttendance(req, res, next),
);

// ── Bulk mark attendance ──────────────────────────────────────────────────
router.post(
    "/bulk",
    authenticate,
    requireTenant,
    requireStaff,
    validate(BulkMarkAttendanceDto),
    (req, res, next) => ctrl().bulkMarkAttendance(req, res, next),
);
// ── Get attendance summary for a student ──────────────────────────────────
router.get(
    "/summary/:studentId",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getAttendanceSummary(req, res, next),
);

// ── Mark single attendance ────────────────────────────────────────────────
router.post(
    "/:classId",
    authenticate,
    requireTenant,
    requireStaff,
    validate(MarkAttendanceDto),
    (req, res, next) => ctrl().markAttendance(req, res, next),
);


// ── Update attendance ─────────────────────────────────────────────────────
router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireStaff,
    validate(UpdateAttendanceDto),
    (req, res, next) => ctrl().updateAttendance(req, res, next),
);

export default router;