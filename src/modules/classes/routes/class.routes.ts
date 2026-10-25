import { Router } from "express";
import { container } from "../../../container";
import { ClassController } from "../controllers/class.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import {
    CreateClassDto, UpdateClassDto, SetClassTeacherDto, SetClassProgressionDto,
    CreateSubjectDto, AssignSubjectDto, BulkAssignSubjectsDto, SetSubjectDefaultTeacherDto,
} from "../dtos/class.dto";

/*
| CLASS ROUTES (school realm, mounted at /classes on the school's host).
| classes.view   = see classes, subjects and who teaches what (staff roles)
| classes.manage = create, edit and delete classes and subjects; class teachers; promotion order; subject teachers
| Fixed paths ("/subjects...", "/apply-teaching-defaults") come before "/:id".
| (The subject and teacher-assignment routes only got their permission guards in this pass; their use cases are hardened next.)
*/
const router = Router();
const ctrl   = () => container.resolve<ClassController>("classController");
const view   = [authenticate, requireTenant, requirePermission("classes.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("classes.manage")] as const;

router.get("/", ...view, (q, s, n) => ctrl().getClasses(q, s, n));
router.post("/", ...manage, validate(CreateClassDto), (q, s, n) => ctrl().createClass(q, s, n));
router.post("/apply-teaching-defaults", ...manage, (q, s, n) => ctrl().applyTeachingDefaults(q, s, n));

router.get("/subjects/all", ...view, (q, s, n) => ctrl().getSubjects(q, s, n));
router.post("/subjects", ...manage, validate(CreateSubjectDto), (q, s, n) => ctrl().createSubject(q, s, n));
router.put("/subjects/:id/default-teacher", ...manage, validate(SetSubjectDefaultTeacherDto), (q, s, n) => ctrl().setSubjectDefaultTeacher(q, s, n));

router.get("/:id", ...view, (q, s, n) => ctrl().getClassById(q, s, n));
router.put("/:id", ...manage, validate(UpdateClassDto), (q, s, n) => ctrl().updateClass(q, s, n));
router.delete("/:id", ...manage, (q, s, n) => ctrl().deleteClass(q, s, n));
router.put("/:id/class-teacher", ...manage, validate(SetClassTeacherDto), (q, s, n) => ctrl().setClassTeacher(q, s, n));
router.put("/:id/progression", ...manage, validate(SetClassProgressionDto), (q, s, n) => ctrl().setClassProgression(q, s, n));

router.get("/:id/subjects", ...view, (q, s, n) => ctrl().getClassSubjects(q, s, n));
router.post("/:id/subjects", ...manage, validate(AssignSubjectDto), (q, s, n) => ctrl().assignSubject(q, s, n));
router.post("/:id/subjects/bulk-assign", ...manage, validate(BulkAssignSubjectsDto), (q, s, n) => ctrl().bulkAssignSubjects(q, s, n));
router.patch("/:id/subjects/:classSubjectId/clear-override", ...manage, (q, s, n) => ctrl().clearSubjectOverride(q, s, n));
router.delete("/:id/subjects/:classSubjectId", ...manage, (q, s, n) => ctrl().removeSubject(q, s, n));

export default router;
