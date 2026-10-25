import { Router } from "express";
import { container } from "../../../container";
import { FinanceReportController } from "../controllers/report.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";

/*
| FINANCE REPORT ROUTES (school realm, mounted at /finance, after the ledger routes so /reports/account-balances and /reports/cash-book keep working).
|   GET /reports                    finance.reports.view   the reports this person may run
|   GET /reports/:key               the permission and plan feature of that report (see the catalogue)   (settings in the query string)
|   GET /reports/:key/export        finance.reports.export + the report's own permission                   CSV file (?format=csv)
|   GET /dashboard                  finance.reports.view   the proprietor's key numbers
| The report's own permission and plan feature are checked by the engine, because they differ report by report.
*/
const router = Router();
const ctrl = () => container.resolve<FinanceReportController>("financeReportController");
const base = [authenticate, requireTenant] as const;

router.get("/reports", ...base, requirePermission("finance.reports.view"), requireFeature("modules.fees"), (q, s, n) => ctrl().list(q, s, n));
router.get("/dashboard", ...base, requirePermission("finance.reports.view"), requireFeature("modules.fees"), (q, s, n) => ctrl().dashboard(q, s, n));
router.get("/reports/:key/export", ...base, (q, s, n) => ctrl().export(q, s, n));
router.get("/reports/:key", ...base, (q, s, n) => ctrl().run(q, s, n));

export default router;
