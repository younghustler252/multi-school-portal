import { Router }               from "express";
import { container }            from "../../../container";
import { GuardianController }   from "../controllers/guardian.controller";
import { validate }             from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }         from "../../../infrastructure/middleware/auth.middleware";
import {
    requireSchoolAdmin,
    requireStaff,
}                               from "../../../infrastructure/middleware/rbac.middleware";
import { requireTenant }        from "../../../infrastructure/middleware/tenant-resolver.middleware";
import {
    CreateGuardianDto,
    UpdateGuardianDto,
    LinkGuardianDto,
    ListGuardiansDto,
}                               from "../dtos/guardian.dto";

/*
|--------------------------------------------------------------------------
| GUARDIAN ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<GuardianController>("guardianController");

// ── List guardians ────────────────────────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireTenant,
    requireStaff,
    validate(ListGuardiansDto, "query"),
    (req, res, next) => ctrl().listGuardians(req, res, next),
);

// ── Get guardian ──────────────────────────────────────────────────────────
router.get(
    "/:id",
    authenticate,
    requireTenant,
    requireStaff,
    (req, res, next) => ctrl().getGuardian(req, res, next),
);

// ── Create guardian ───────────────────────────────────────────────────────
router.post(
    "/",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(CreateGuardianDto),
    (req, res, next) => ctrl().createGuardian(req, res, next),
);

// ── Update guardian ───────────────────────────────────────────────────────
router.put(
    "/:id",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(UpdateGuardianDto),
    (req, res, next) => ctrl().updateGuardian(req, res, next),
);

// ── Invite guardian to portal ─────────────────────────────────────────────
router.post(
    "/:id/invite",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    (req, res, next) => ctrl().inviteGuardian(req, res, next),
);

// ── Link guardian to another student ─────────────────────────────────────
router.post(
    "/:id/link",
    authenticate,
    requireTenant,
    requireSchoolAdmin,
    validate(LinkGuardianDto),
    (req, res, next) => ctrl().linkGuardian(req, res, next),
);

export default router;