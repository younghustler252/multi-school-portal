import { Router }              from "express";
import multer                  from "multer";
import { container }           from "../../../container";
import { StudentController }   from "../controllers/student.controller";
import { validate }            from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }        from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                              from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }       from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePlanLimit }    from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    CreateStudentDto,
    UpdateStudentDto,
    ListStudentsDto,
}                              from "../dtos/student.dto";

/*
|--------------------------------------------------------------------------
| STUDENT ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 3 * 1024 * 1024 }, // 3MB
});

const ctrl = () => container.resolve<StudentController>("studentController");

// ── List students ─────────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListStudentsDto, "query"),
    (req, res, next) => ctrl().listStudents(req, res, next),
);

// ── Get single student ────────────────────────────────────────────────────
router.get(
    "/:id",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getStudent(req, res, next),
);

// ── Create student ────────────────────────────────────────────────────────
router.post(
    "/",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    requirePlanLimit("student"),
    validate(CreateStudentDto),
    (req, res, next) => ctrl().createStudent(req, res, next),
);

// ── Update student ────────────────────────────────────────────────────────
router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(UpdateStudentDto),
    (req, res, next) => ctrl().updateStudent(req, res, next),
);

// ── Deactivate student ────────────────────────────────────────────────────
router.delete(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().deactivateStudent(req, res, next),
);

// ── Upload photo ──────────────────────────────────────────────────────────
router.post(
    "/:id/photo",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    upload.single("photo"),
    (req, res, next) => ctrl().uploadPhoto(req, res, next),
);

export default router;