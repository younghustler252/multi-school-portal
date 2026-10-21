import { Router } from "express";
import { container } from "../../../container";
import { LedgerController } from "../controllers/ledger.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { OpeningBalanceDto, TransferDto, ManualJournalDto, ReverseJournalDto } from "../dtos/ledger.dto";

/*
| LEDGER ROUTES (school realm, mounted at /finance on the school's host).
| Every route: authenticate, tenant, permission, then the finance entitlement (modules.fees), then validation.
|   GET  /journals, /journals/:id          finance.journals.view
|   POST /journals                         finance.journals.post     manual journal (needs a written reason)
|   POST /journals/:id/reverse             finance.journals.reverse
|   POST /opening-balances, /transfers     finance.journals.post
|   GET  /periods                          finance.periods.view
|   GET  /reports/account-balances         finance.reports.view
|   GET  /reports/cash-book                finance.reports.view
*/
const router = Router();
const ctrl = () => container.resolve<LedgerController>("ledgerController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/journals", ...guard("finance.journals.view"), (q, s, n) => ctrl().listJournals(q, s, n));
router.post("/journals", ...guard("finance.journals.post"), validate(ManualJournalDto), (q, s, n) => ctrl().postManual(q, s, n));
router.get("/journals/:id", ...guard("finance.journals.view"), (q, s, n) => ctrl().getJournal(q, s, n));
router.post("/journals/:id/reverse", ...guard("finance.journals.reverse"), validate(ReverseJournalDto), (q, s, n) => ctrl().reverse(q, s, n));

router.post("/opening-balances", ...guard("finance.journals.post"), validate(OpeningBalanceDto), (q, s, n) => ctrl().openingBalance(q, s, n));
router.post("/transfers", ...guard("finance.journals.post"), validate(TransferDto), (q, s, n) => ctrl().transfer(q, s, n));

router.get("/periods", ...guard("finance.periods.view"), (q, s, n) => ctrl().periods(q, s, n));

router.get("/reports/account-balances", ...guard("finance.reports.view"), (q, s, n) => ctrl().accountBalances(q, s, n));
router.get("/reports/cash-book", ...guard("finance.reports.view"), (q, s, n) => ctrl().cashBook(q, s, n));

export default router;
