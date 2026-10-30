import { Router } from "express";
import { container } from "../../../container";
import { AttendanceController } from "../controllers/attendance.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { SubmitRegisterDto, UpdateAttendanceDto } from "../dtos/attendance.dto";

/*
| ATTENDANCE ROUTES (school realm, mounted at /attendance on the school's host).
| attendance.view      = open a class register, list marks, summaries (scope decides whose)
| attendance.mark      = take the class register, correct a mark (scope decides which classes)
| attendance.override  = also correct marks after the 48-hour edit window (checked inside the use cases)
| Fixed paths ("/summary", "/classes/...") come before "/:id".
*/
const router = Router();
const ctrl   = () => container.resolve<AttendanceController>("attendanceController");
const view   = [authenticate, requireTenant, requirePermission("attendance.view")] as const;
const mark   = [authenticate, requireTenant, requirePermission("attendance.mark")] as const;

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.get("/summary", ...view, (q, s, n) => ctrl().studentSummary(q, s, n));
router.get("/classes/:classId/register", ...view, (q, s, n) => ctrl().register(q, s, n));
router.get("/classes/:classId/summary", ...view, (q, s, n) => ctrl().classSummary(q, s, n));
router.post("/classes/:classId", ...mark, validate(SubmitRegisterDto), (q, s, n) => ctrl().submit(q, s, n));
router.put("/:id", ...mark, validate(UpdateAttendanceDto), (q, s, n) => ctrl().update(q, s, n));

export default router;
