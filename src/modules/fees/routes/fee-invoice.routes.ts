import { Router } from "express";
import { container } from "../../../container";
import { FeeInvoiceController } from "../controllers/fee-invoice.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { InvoiceExtrasController } from "../controllers/invoice-extras.controller";
import { SaveInstalmentPlanDto, OpeningBalancesDto, RunLateFeesDto } from "../dtos/instalment.dto";
import { GenerateInvoicesDto, CreateInvoiceDto, UpdateDraftInvoiceDto, IssueInvoiceDto, BulkIssueDto, VoidInvoiceDto } from "../dtos/invoice.dto";

/*
| INVOICE ROUTES (school realm, mounted at /fees/invoices). Every route: authenticate, tenant, permission, fees entitlement, validation.
|   GET    /                 fees.invoices.view     (?status, ?type, ?termId, ?classId, ?studentId, ?branchId, ?q, ?page, ?limit)
|   POST   /                 fees.invoices.create   one draft by hand (admission, one-off)
|   POST   /generate         fees.invoices.create   drafts for a term's students from the structures
|   POST   /issue            fees.invoices.issue    issue many drafts
|   GET    /:id              fees.invoices.view
|   PUT    /:id, DELETE /:id fees.invoices.create   drafts only
|   POST   /:id/issue        fees.invoices.issue    numbers it and posts it to the books
|   POST   /:id/void         fees.invoices.void     before any payment or adjustment
|   POST   /opening-balances fees.invoices.issue   what students owed before the system began, one issued invoice each
|   POST   /late-fees/run    fees.invoices.issue   charge late fees on overdue invoices ({dryRun:true} lists only)
|   PUT/GET/DELETE /:id/instalments  issue (write) / view (read)  a schedule on an open invoice; moves no money
*/
const router = Router();
const ctrl = () => container.resolve<FeeInvoiceController>("feeInvoiceController");
const extras = () => container.resolve<InvoiceExtrasController>("invoiceExtrasController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/", ...guard("fees.invoices.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...guard("fees.invoices.create"), validate(CreateInvoiceDto), (q, s, n) => ctrl().create(q, s, n));
router.post("/generate", ...guard("fees.invoices.create"), validate(GenerateInvoicesDto), (q, s, n) => ctrl().generate(q, s, n));
router.post("/issue", ...guard("fees.invoices.issue"), validate(BulkIssueDto), (q, s, n) => ctrl().bulkIssue(q, s, n));
router.post("/opening-balances", ...guard("fees.invoices.issue"), validate(OpeningBalancesDto), (q, s, n) => extras().openingBalances(q, s, n));
router.post("/late-fees/run", ...guard("fees.invoices.issue"), validate(RunLateFeesDto), (q, s, n) => extras().lateFees(q, s, n));
router.get("/:id", ...guard("fees.invoices.view"), (q, s, n) => ctrl().get(q, s, n));
router.put("/:id", ...guard("fees.invoices.create"), validate(UpdateDraftInvoiceDto), (q, s, n) => ctrl().update(q, s, n));
router.delete("/:id", ...guard("fees.invoices.create"), (q, s, n) => ctrl().remove(q, s, n));
router.post("/:id/issue", ...guard("fees.invoices.issue"), validate(IssueInvoiceDto), (q, s, n) => ctrl().issue(q, s, n));
router.post("/:id/void", ...guard("fees.invoices.void"), validate(VoidInvoiceDto), (q, s, n) => ctrl().voidInvoice(q, s, n));

router.put("/:id/instalments", ...guard("fees.invoices.issue"), validate(SaveInstalmentPlanDto), (q, s, n) => extras().saveInstalments(q, s, n));
router.get("/:id/instalments", ...guard("fees.invoices.view"), (q, s, n) => extras().getInstalments(q, s, n));
router.delete("/:id/instalments", ...guard("fees.invoices.issue"), (q, s, n) => extras().cancelInstalments(q, s, n));

export default router;
