import { Router } from "express";
import { container } from "../../../container";
import { AuditController } from "../controllers/audit.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";

/* PLATFORM AUDIT ROUTES: mounted at /platform/audit on the admin host (replaces requireSuperAdmin with a real permission). */
const router = Router();
const ctrl   = () => container.resolve<AuditController>("auditController");

router.get("/", authenticate, requirePermission("platform.audit.view"), (q, s, n) => ctrl().listPlatform(q, s, n));

export default router;
