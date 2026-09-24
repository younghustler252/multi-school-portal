import { Router }             from "express";
import { container }          from "../../../container";
import { ClassController }    from "../controllers/class.controller";
import { validate }           from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }       from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                             from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }      from "../../../infrastructure/middleware/tenant-resolver.middleware";
import {
    CreateClassDto,
    UpdateClassDto,
    CreateSubjectDto,
    AssignSubjectDto,
    BulkAssignSubjectsDto,
    SetSubjectDefaultTeacherDto
}                             from "../dtos/class.dto";

/*
|--------------------------------------------------------------------------
| CLASS ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<ClassController>("classController");

// ── Classes ───────────────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getClasses(req, res, next),
);

router.post(
    "/",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(CreateClassDto),
    (req, res, next) => ctrl().createClass(req, res, next),
);

router.post(
    "/apply-teaching-defaults",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().applyTeachingDefaults(req, res, next),
);

// ── Subjects (standalone) ─────────────────────────────────────────────────
router.get(
    "/subjects/all",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getSubjects(req, res, next),
);

router.post(
    "/subjects",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(CreateSubjectDto),
    (req, res, next) => ctrl().createSubject(req, res, next),
);

router.put(
    "/subjects/:id/default-teacher",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(SetSubjectDefaultTeacherDto),
    (req, res, next) => ctrl().setSubjectDefaultTeacher(req, res, next),
);

// ── Class by ID ───────────────────────────────────────────────────────────
router.get(
    "/:id",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getClassById(req, res, next),
);

router.put(
    "/:id/class-teacher",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().setClassTeacher(req, res, next),
);



router.put(
    "/:id/progression",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().setClassProgression(req, res, next),
);

router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(UpdateClassDto),
    (req, res, next) => ctrl().updateClass(req, res, next),
);

router.delete(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().deleteClass(req, res, next),
);

// ── Class subjects ────────────────────────────────────────────────────────
router.get(
    "/:id/subjects",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getClassSubjects(req, res, next),
);

router.post(
    "/:id/subjects",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(AssignSubjectDto),
    (req, res, next) => ctrl().assignSubject(req, res, next),
);

router.post(
    "/:id/subjects/bulk-assign",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(BulkAssignSubjectsDto),
    (req, res, next) => ctrl().bulkAssignSubjects(req, res, next),
);

router.patch(
    "/:id/subjects/:classSubjectId/clear-override",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().clearSubjectOverride(req, res, next),
);

router.delete(
    "/:id/subjects/:classSubjectId",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().removeSubject(req, res, next),
);

export default router;
