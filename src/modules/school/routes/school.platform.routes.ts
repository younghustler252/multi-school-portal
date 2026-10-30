import { Router } from "express";
import { container } from "../../../container";
import { SchoolPlatformController } from "../controllers/school-platform.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import {
    CreateSchoolDto, PlatformUpdateSchoolDto, VerifySchoolDto, RejectSchoolDto, SuspendSchoolDto, RejectDocumentDto,
} from "../dtos/school.dto";

/*
| PLATFORM SCHOOL ROUTES — mounted at /platform/schools, used on the admin host.
| Platform permissions only work for platform sessions (a school session can never hold them),
| so a school user cannot reach any of this.
*/

const router = Router();
const ctrl   = () => container.resolve<SchoolPlatformController>("schoolPlatformController");

router.get("/",  authenticate, requirePermission("platform.schools.view"),   (q, s, n) => ctrl().list(q, s, n));
router.post("/", authenticate, requirePermission("platform.schools.create"), validate(CreateSchoolDto), (q, s, n) => ctrl().create(q, s, n));

// Provisioning: which schools are ready, waiting or failed, and a retry (registered before "/:id")
router.get("/provisioning",          authenticate, requirePermission("platform.schools.provisioning"),       (q, s, n) => ctrl().provisioning(q, s, n));
router.post("/:id/provisioning/retry", authenticate, requirePermission("platform.schools.provisioning.retry"), (q, s, n) => ctrl().retryProvisioning(q, s, n));

// Documents (registered before "/:id" routes for readability; the paths do not overlap)
router.put("/documents/:documentId/approve", authenticate, requirePermission("platform.schools.verify"), (q, s, n) => ctrl().approveDocument(q, s, n));
router.put("/documents/:documentId/reject",  authenticate, requirePermission("platform.schools.verify"), validate(RejectDocumentDto), (q, s, n) => ctrl().rejectDocument(q, s, n));

router.get("/:id",            authenticate, requirePermission("platform.schools.view"),      (q, s, n) => ctrl().get(q, s, n));
router.put("/:id",            authenticate, requirePermission("platform.schools.manage"),    validate(PlatformUpdateSchoolDto), (q, s, n) => ctrl().update(q, s, n));
router.get("/:id/documents",  authenticate, requirePermission("platform.schools.documents"), (q, s, n) => ctrl().listDocuments(q, s, n));
router.put("/:id/verify",     authenticate, requirePermission("platform.schools.verify"),    validate(VerifySchoolDto), (q, s, n) => ctrl().verify(q, s, n));
router.put("/:id/reject",     authenticate, requirePermission("platform.schools.verify"),    validate(RejectSchoolDto), (q, s, n) => ctrl().reject(q, s, n));
router.put("/:id/suspend",    authenticate, requirePermission("platform.schools.suspend"),   validate(SuspendSchoolDto), (q, s, n) => ctrl().suspend(q, s, n));
router.put("/:id/reactivate", authenticate, requirePermission("platform.schools.suspend"),  (q, s, n) => ctrl().reactivate(q, s, n));

export default router;
