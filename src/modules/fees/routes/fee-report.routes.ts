import { Router } from "express";
import { container } from "../../../container";
import { FeeReportController } from "../controllers/fee-report.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";

/*
| REPORT AND FAMILY ROUTES (school realm, mounted at /fees, before the set-up routes). Every route: authenticate, tenant, permission, fees entitlement.
|   GET /reports/ageing           fees.reports.view   (?asOf, ?branchId, ?classId, ?termId)  what is owed, by how late
|   GET /reports/defaulters       fees.reports.view   (same, ?minimumKobo)                   students with something overdue
|   GET /reports/collections      fees.reports.view   (?from, ?to, ?groupBy=method|day|month|branch|class, ?branchId)
|   GET /statements/:studentId    fees.invoices.view  (?from, ?to)
|   GET /my/children              fees.view           a guardian's children (or the student): owed, overdue, credit
|   GET /my/invoices              fees.view           (?studentId) issued invoices of my children
|   GET /my/statement/:studentId  fees.view           (?from, ?to) a statement, only for my own child
*/
const router = Router();
const ctrl = () => container.resolve<FeeReportController>("feeReportController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/reports/ageing", ...guard("fees.reports.view"), (q, s, n) => ctrl().ageing(q, s, n));
router.get("/reports/defaulters", ...guard("fees.reports.view"), (q, s, n) => ctrl().defaulters(q, s, n));
router.get("/reports/collections", ...guard("fees.reports.view"), (q, s, n) => ctrl().collections(q, s, n));
router.get("/statements/:studentId", ...guard("fees.invoices.view"), (q, s, n) => ctrl().statement(q, s, n));
router.get("/my/children", ...guard("fees.view"), (q, s, n) => ctrl().myChildren(q, s, n));
router.get("/my/invoices", ...guard("fees.view"), (q, s, n) => ctrl().myInvoices(q, s, n));
router.get("/my/statement/:studentId", ...guard("fees.view"), (q, s, n) => ctrl().myStatement(q, s, n));

export default router;
