import { Router } from "express";
import { container } from "../../../container";
import { PayrollController } from "../controllers/payroll.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";

/*
| MY PAYSLIPS (school realm, mounted at /my/payslips): a staff member's own payslips only, whatever scope their role holds.
|   GET /, GET /:id, GET /:id/document     payroll.payslips.view
*/
const router = Router();
const ctrl = () => container.resolve<PayrollController>("payrollController");
const guard = [authenticate, requireTenant, requirePermission("payroll.payslips.view"), requireFeature("modules.payroll")] as const;

router.get("/", ...guard, (q, s, n) => ctrl().myPayslips(q, s, n));
router.get("/:id", ...guard, (q, s, n) => ctrl().myPayslip(q, s, n));
router.get("/:id/document", ...guard, (q, s, n) => ctrl().document(true)(q, s, n));

export default router;
