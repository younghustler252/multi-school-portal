import { Router } from "express";
import { container } from "../../../container";
import { PayrollController } from "../controllers/payroll.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    CreateComponentDto, UpdateComponentDto, SetProfileDto, CreateRunDto, ApproveRunDto, RejectRunDto, CancelRunDto, ReverseRunDto, PayRunDto,
    CreateLoanDto, CancelLoanDto, CreateRemittanceDto, ReverseRemittanceDto,
} from "../dtos/payroll.dto";

/*
| PAYROLL ROUTES (school realm, mounted at /payroll). Every route needs the plan feature modules.payroll.
|   /components   GET (payroll.runs.view); POST, PUT, activate, deactivate, DELETE (payroll.components.manage)
|   /profiles     GET list, GET /:staffId, POST (payroll.profiles.manage)
|   /runs         GET, GET /:id (payroll.runs.view); POST, /:id/calculate, /submit, /cancel (payroll.runs.create);
|                 /:id/approve, /reject, /reverse (payroll.runs.approve); /:id/pay (payroll.runs.pay)
|   /payslips     GET, GET /:id, GET /:id/document (payroll.payslips.view, ALL or OWN scope)
|   /loans        payroll.loans.manage         /remittances   payroll.remittances.manage
*/
const router = Router();
const ctrl = () => container.resolve<PayrollController>("payrollController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.payroll")] as const;

router.get("/components", ...guard("payroll.runs.view"), (q, s, n) => ctrl().listComponents(q, s, n));
router.post("/components", ...guard("payroll.components.manage"), validate(CreateComponentDto), (q, s, n) => ctrl().createComponent(q, s, n));
router.get("/components/:id", ...guard("payroll.runs.view"), (q, s, n) => ctrl().getComponent(q, s, n));
router.put("/components/:id", ...guard("payroll.components.manage"), validate(UpdateComponentDto), (q, s, n) => ctrl().updateComponent(q, s, n));
router.post("/components/:id/deactivate", ...guard("payroll.components.manage"), (q, s, n) => ctrl().setComponentActive(false)(q, s, n));
router.post("/components/:id/reactivate", ...guard("payroll.components.manage"), (q, s, n) => ctrl().setComponentActive(true)(q, s, n));
router.delete("/components/:id", ...guard("payroll.components.manage"), (q, s, n) => ctrl().deleteComponent(q, s, n));

router.get("/profiles", ...guard("payroll.profiles.manage"), (q, s, n) => ctrl().listProfiles(q, s, n));
router.post("/profiles", ...guard("payroll.profiles.manage"), validate(SetProfileDto), (q, s, n) => ctrl().setProfile(q, s, n));
router.get("/profiles/:staffId", ...guard("payroll.profiles.manage"), (q, s, n) => ctrl().getProfile(q, s, n));

router.get("/runs", ...guard("payroll.runs.view"), (q, s, n) => ctrl().listRuns(q, s, n));
router.post("/runs", ...guard("payroll.runs.create"), validate(CreateRunDto), (q, s, n) => ctrl().createRun(q, s, n));
router.get("/runs/:id", ...guard("payroll.runs.view"), (q, s, n) => ctrl().getRun(q, s, n));
router.post("/runs/:id/calculate", ...guard("payroll.runs.create"), (q, s, n) => ctrl().calculate(q, s, n));
router.post("/runs/:id/submit", ...guard("payroll.runs.create"), (q, s, n) => ctrl().submit(q, s, n));
router.post("/runs/:id/cancel", ...guard("payroll.runs.create"), validate(CancelRunDto), (q, s, n) => ctrl().cancel(q, s, n));
router.post("/runs/:id/approve", ...guard("payroll.runs.approve"), validate(ApproveRunDto), (q, s, n) => ctrl().approve(q, s, n));
router.post("/runs/:id/reject", ...guard("payroll.runs.approve"), validate(RejectRunDto), (q, s, n) => ctrl().reject(q, s, n));
router.post("/runs/:id/reverse", ...guard("payroll.runs.approve"), validate(ReverseRunDto), (q, s, n) => ctrl().reverse(q, s, n));
router.post("/runs/:id/pay", ...guard("payroll.runs.pay"), validate(PayRunDto), (q, s, n) => ctrl().pay(q, s, n));

router.get("/payslips", ...guard("payroll.payslips.view"), (q, s, n) => ctrl().listPayslips(q, s, n));
router.get("/payslips/:id", ...guard("payroll.payslips.view"), (q, s, n) => ctrl().getPayslip(q, s, n));
router.get("/payslips/:id/document", ...guard("payroll.payslips.view"), (q, s, n) => ctrl().document(false)(q, s, n));

router.get("/loans", ...guard("payroll.loans.manage"), (q, s, n) => ctrl().listLoans(q, s, n));
router.post("/loans", ...guard("payroll.loans.manage"), validate(CreateLoanDto), (q, s, n) => ctrl().createLoan(q, s, n));
router.get("/loans/:id", ...guard("payroll.loans.manage"), (q, s, n) => ctrl().getLoan(q, s, n));
router.post("/loans/:id/cancel", ...guard("payroll.loans.manage"), validate(CancelLoanDto), (q, s, n) => ctrl().cancelLoan(q, s, n));

router.get("/remittances", ...guard("payroll.remittances.manage"), (q, s, n) => ctrl().listRemittances(q, s, n));
router.get("/remittances/due", ...guard("payroll.remittances.manage"), (q, s, n) => ctrl().remittancesDue(q, s, n));
router.post("/remittances", ...guard("payroll.remittances.manage"), validate(CreateRemittanceDto), (q, s, n) => ctrl().createRemittance(q, s, n));
router.post("/remittances/:id/reverse", ...guard("payroll.remittances.manage"), validate(ReverseRemittanceDto), (q, s, n) => ctrl().reverseRemittance(q, s, n));

export default router;
