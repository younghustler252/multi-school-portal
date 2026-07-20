import { Router }           from "express";
import { container }        from "../../../container";
import { AuditController }  from "../controllers/audit.controller";
import { validate }         from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }     from "../../../infrastructure/middleware/auth.middleware";
import { requireSuperAdmin } from "../../../infrastructure/middleware/rbac.middleware";
import { ListAuditLogsDto } from "../dtos/audit.dto";

const router = Router();
const ctrl   = () => container.resolve<AuditController>("auditController");

// ── Super admin views all audit logs ──────────────────────────────────────
router.get(
    "/",
    authenticate,
    requireSuperAdmin,
    validate(ListAuditLogsDto, "query"),
    (req, res, next) => ctrl().getAuditLogs(req, res, next),
);

export default router;