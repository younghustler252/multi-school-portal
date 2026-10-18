import { Router } from "express";
import { container } from "../../../container";
import { BranchController } from "../controllers/branch.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { CreateBranchDto, UpdateBranchDto, AssignBranchesDto } from "../dtos/branch.dto";

/*
| BRANCH ROUTES (school realm, mounted at /branches on the school's host).
| view   = see branches (all of them, or only the person's own when their role is limited to their branch)
| manage = create, edit, deactivate, delete and assign staff
| Creating a branch is gated by the plan's `branches.max` limit inside the use case.
| Fixed paths ("/mine", "/assignments/...") come before "/:id".
*/
const router = Router();
const ctrl   = () => container.resolve<BranchController>("branchController");
const view   = [authenticate, requireTenant, requirePermission("branches.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("branches.manage")] as const;

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.get("/mine", ...view, (q, s, n) => ctrl().mine(q, s, n));
router.post("/", ...manage, validate(CreateBranchDto), (q, s, n) => ctrl().create(q, s, n));
router.put("/assignments/:membershipId", ...manage, validate(AssignBranchesDto), (q, s, n) => ctrl().assign(q, s, n));

router.get("/:id", ...view, (q, s, n) => ctrl().get(q, s, n));
router.get("/:id/members", ...manage, (q, s, n) => ctrl().members(q, s, n));
router.put("/:id", ...manage, validate(UpdateBranchDto), (q, s, n) => ctrl().update(q, s, n));
router.put("/:id/deactivate", ...manage, (q, s, n) => ctrl().deactivate(q, s, n));
router.put("/:id/reactivate", ...manage, (q, s, n) => ctrl().reactivate(q, s, n));
router.delete("/:id", ...manage, (q, s, n) => ctrl().remove(q, s, n));

export default router;
