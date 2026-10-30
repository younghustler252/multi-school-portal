import { Router } from "express";
import { container } from "../../../container";
import { EnrolmentController } from "../controllers/enrolment.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { EnrolStudentDto, BulkEnrolDto, UpdateEnrolmentDto, PromoteStudentsDto } from "../dtos/enrolment.dto";

/*
| ENROLMENT ROUTES (school realm, mounted at /enrolments on the school's host).
| enrolment.view     = see class lists (all, only the classes you lead or teach, or only your own / your children's)
| enrolment.manage   = enrol, bulk enrol, move a student to another class, withdraw or re-activate
| enrolment.promote  = end-of-year promotion (preview, then promote)
| Fixed paths ("/bulk", "/promotion-preview", "/promote") come before "/:id".
*/
const router  = Router();
const ctrl    = () => container.resolve<EnrolmentController>("enrolmentController");
const view    = [authenticate, requireTenant, requirePermission("enrolment.view")] as const;
const manage  = [authenticate, requireTenant, requirePermission("enrolment.manage")] as const;
const promote = [authenticate, requireTenant, requirePermission("enrolment.promote")] as const;

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...manage, validate(EnrolStudentDto), (q, s, n) => ctrl().enrol(q, s, n));
router.post("/bulk", ...manage, validate(BulkEnrolDto), (q, s, n) => ctrl().bulkEnrol(q, s, n));
router.get("/promotion-preview", ...promote, (q, s, n) => ctrl().previewPromotion(q, s, n));
router.post("/promote", ...promote, validate(PromoteStudentsDto), (q, s, n) => ctrl().promote(q, s, n));
router.put("/:id", ...manage, validate(UpdateEnrolmentDto), (q, s, n) => ctrl().update(q, s, n));

export default router;
