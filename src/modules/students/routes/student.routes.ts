import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { container } from "../../../container";
import { StudentController } from "../controllers/student.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { uploadLimiter } from "../../../infrastructure/middleware/rate-limit.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission, requirePersona } from "../../../infrastructure/middleware/rbac.middleware";
import { reestablishTenantContext } from "../../../infrastructure/middleware/reestablish-tenant-context";
import { AppError } from "../../../shared/errors/domain.errors";
import { MAX_PHOTO_BYTES } from "../domain/student.policy";
import { CreateStudentDto, UpdateStudentDto, DeactivateStudentDto } from "../dtos/student.dto";

/*
| STUDENT ROUTES (school realm, mounted at /students on the school's host).
| students.view   = see students (all of them, or only yourself / your own children, depending on the role's scope)
| students.manage = create, edit, deactivate, reactivate, change photo
| The plan's student limit is checked inside create and reactivate.
| Fixed paths ("/me") come before "/:id".
| Upload route: authenticate -> permission -> limiter -> multer -> reestablishTenantContext -> controller.
| Not here yet: CSV import and bulk create (they need Guardians, Classes, Sessions and Enrolment switched on first).
*/
const router = Router();
const ctrl   = () => container.resolve<StudentController>("studentController");
const view   = [authenticate, requireTenant, requirePermission("students.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("students.manage")] as const;
const self   = [authenticate, requireTenant, requirePersona("STUDENT")] as const;

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES } });
// Turns multer failures (too large, wrong field) into the standard error shape
const photo = (req: Request, res: Response, next: NextFunction) =>
    photoUpload.single("photo")(req, res, (err: unknown) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) return next(new AppError(err.code === "LIMIT_FILE_SIZE" ? "Image must be 2 MB or smaller" : "Upload failed", 400, true, "INVALID_IMAGE"));
        next(err);
    });

router.get("/me", ...self, (q, s, n) => ctrl().me(q, s, n));

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...manage, validate(CreateStudentDto), (q, s, n) => ctrl().create(q, s, n));

router.get("/:id", ...view, (q, s, n) => ctrl().get(q, s, n));
router.put("/:id", ...manage, validate(UpdateStudentDto), (q, s, n) => ctrl().update(q, s, n));
router.post("/:id/deactivate", ...manage, validate(DeactivateStudentDto), (q, s, n) => ctrl().deactivate(q, s, n));
router.post("/:id/reactivate", ...manage, (q, s, n) => ctrl().reactivate(q, s, n));
router.post("/:id/photo", ...manage, uploadLimiter, photo, reestablishTenantContext, (q, s, n) => ctrl().uploadPhoto(q, s, n));

export default router;
