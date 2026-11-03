import { Router } from "express";
import { container } from "../../../container";
import { RolesController } from "../controllers/roles.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";

/*
| ROLE ROUTES (school realm, mounted at /roles; /permissions is mounted alongside it — see routes/index.ts).
| roles.view   = see roles, their permissions, and who holds each one.
| roles.manage = create, edit, delete. A role can only be handed permissions the acting person already holds
| themselves (checked inside the use cases), so this never lets someone build a role more powerful than they are.
| Fixed paths ("/permissions") are mounted on their own base path, so there is no "/:id" ordering issue here.
*/
const router = Router();
const ctrl   = () => container.resolve<RolesController>("rolesController");
const view   = [authenticate, requireTenant, requirePermission("roles.view")] as const;
const manage = [authenticate, requireTenant, requirePermission("roles.manage")] as const;

router.get("/", ...view, (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...manage, (q, s, n) => ctrl().create(q, s, n));
router.get("/:id", ...view, (q, s, n) => ctrl().get(q, s, n));
router.get("/:id/members", ...view, (q, s, n) => ctrl().members(q, s, n));
router.put("/:id", ...manage, (q, s, n) => ctrl().update(q, s, n));
router.delete("/:id", ...manage, (q, s, n) => ctrl().remove(q, s, n));

export default router;

/** GET /permissions — the catalog a role can be built from. Its own tiny router, mounted at /permissions. */
export const permissionsRouter = Router();
permissionsRouter.get("/", ...view, (q, s, n) => ctrl().permissions(q, s, n));
