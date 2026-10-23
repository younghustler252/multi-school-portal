import { Router } from "express";
import { container } from "../../../container";
import { GuardianController } from "../controllers/guardian.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission, requirePersona } from "../../../infrastructure/middleware/rbac.middleware";
import { CreateGuardianDto, UpdateGuardianDto, LinkGuardianDto, UpdateGuardianLinkDto, BulkInviteGuardiansDto } from "../dtos/guardian.dto";

/*
| GUARDIAN ROUTES (school realm, mounted at /guardians on the school's host).
| guardians.view   = see guardians and their contact details (including "guardians of a student")
| guardians.manage = create, edit, link, unlink, invite
| /me/children is for the GUARDIAN persona only: who they are comes from the session, never from the request.
| Fixed paths ("/me/children", "/invite/bulk") come before "/:id".
*/
const router = Router();
const ctrl   = () => container.resolve<GuardianController>("guardianController");
const view   = [authenticate, requireTenant, requirePermission("guardians.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("guardians.manage")] as const;
const mine   = [authenticate, requireTenant, requirePersona("GUARDIAN")] as const;

router.get("/me/children", ...mine, (q, s, n) => ctrl().myChildren(q, s, n));
router.post("/invite/bulk", ...manage, validate(BulkInviteGuardiansDto), (q, s, n) => ctrl().bulkInvite(q, s, n));

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...manage, validate(CreateGuardianDto), (q, s, n) => ctrl().create(q, s, n));

router.get("/:id", ...view, (q, s, n) => ctrl().get(q, s, n));
router.put("/:id", ...manage, validate(UpdateGuardianDto), (q, s, n) => ctrl().update(q, s, n));
router.post("/:id/invite", ...manage, (q, s, n) => ctrl().invite(q, s, n));
router.post("/:id/link", ...manage, validate(LinkGuardianDto), (q, s, n) => ctrl().link(q, s, n));
router.put("/:id/students/:studentId", ...manage, validate(UpdateGuardianLinkDto), (q, s, n) => ctrl().updateLink(q, s, n));
router.delete("/:id/students/:studentId", ...manage, (q, s, n) => ctrl().unlink(q, s, n));

export default router;
