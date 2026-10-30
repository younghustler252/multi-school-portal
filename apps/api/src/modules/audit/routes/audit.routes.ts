import { Router } from "express";
import { container } from "../../../container";
import { AuditController } from "../controllers/audit.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";

/* SCHOOL AUDIT ROUTES: mounted at /audit on the school's host. Shows only that school's own activity. */
const router = Router();
const ctrl   = () => container.resolve<AuditController>("auditController");

router.get("/", authenticate, requireTenant, requirePermission("audit.view"), (q, s, n) => ctrl().listSchool(q, s, n));

export default router;
