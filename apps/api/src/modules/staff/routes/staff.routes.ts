import { Router } from "express";
import { container } from "../../../container";
import { StaffController } from "../controllers/staff.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission, requirePersona } from "../../../infrastructure/middleware/rbac.middleware";
import {
    CreateStaffDto, UpdateStaffDto, SetStaffBranchesDto, DeactivateStaffDto, InviteStaffDto, ChangeStaffRolesDto,
} from "../dtos/staff.dto";

/*
| STAFF ROUTES (school realm, mounted at /staff on the school's host).
| staff.view   = see staff (all, or only those in the person's branches, or only themselves, depending on the role's scope)
| staff.manage = create, edit, set branches, deactivate, invite, change roles (all, or only inside their own branches)
| Inviting also needs users.invite. The plan's staff limit is checked inside create/reactivate.
| Fixed paths ("/export", "/me") come before "/:id".
*/
const router = Router();
const ctrl   = () => container.resolve<StaffController>("staffController");
const view   = [authenticate, requireTenant, requirePermission("staff.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("staff.manage")] as const;
const self   = [authenticate, requireTenant, requirePersona("STAFF")] as const;

router.get("/export", ...view, (q, s, n) => ctrl().export(q, s, n));
router.get("/me", ...self, (q, s, n) => ctrl().me(q, s, n));
router.get("/me/classes", ...self, (q, s, n) => ctrl().myClasses(q, s, n));

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...manage, validate(CreateStaffDto), (q, s, n) => ctrl().create(q, s, n));

router.get("/:id", ...view, (q, s, n) => ctrl().get(q, s, n));
router.get("/:id/assignments", ...view, (q, s, n) => ctrl().assignments(q, s, n));
router.put("/:id", ...manage, validate(UpdateStaffDto), (q, s, n) => ctrl().update(q, s, n));
router.put("/:id/branches", ...manage, validate(SetStaffBranchesDto), (q, s, n) => ctrl().setBranches(q, s, n));
router.put("/:id/roles", ...manage, validate(ChangeStaffRolesDto), (q, s, n) => ctrl().changeRoles(q, s, n));
router.post("/:id/invite", ...manage, requirePermission("users.invite"), validate(InviteStaffDto), (q, s, n) => ctrl().invite(q, s, n));
router.post("/:id/deactivate", ...manage, validate(DeactivateStaffDto), (q, s, n) => ctrl().deactivate(q, s, n));
router.post("/:id/reactivate", ...manage, (q, s, n) => ctrl().reactivate(q, s, n));

export default router;
