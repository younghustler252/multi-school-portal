import { Router } from "express";
import { container } from "../../../container";
import { LedgerController } from "../controllers/ledger.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { ClosePeriodDto, ReopenPeriodDto, OpeningBalanceDto, TransferDto, ManualJournalDto, ReverseJournalDto, CreateAccountDto, UpdateAccountDto } from "../dtos/ledger.dto";

/*
| LEDGER ROUTES (school realm, mounted at /finance on the school's host).
| Every route: authenticate, tenant, permission, then the finance entitlement (modules.fees), then validation.
|   GET  /accounts, /accounts/:id           finance.accounts.view     (?status=active|inactive|all, ?type=, ?q=, ?withBalances=true)
|   POST /accounts                          finance.accounts.manage
|   PUT  /accounts/:id                      finance.accounts.manage   (system accounts: rename only)
|   POST /accounts/:id/deactivate, /reactivate, DELETE /accounts/:id   finance.accounts.manage
|   GET  /journals, /journals/:id          finance.journals.view
|   POST /journals                         finance.journals.post     manual journal (needs a written reason)
|   POST /journals/:id/reverse             finance.journals.reverse
|   POST /opening-balances, /transfers     finance.journals.post
|   GET  /periods                          finance.periods.view
|   GET  /periods/:id/close-checklist      finance.periods.view      what stands in the way of closing the month
|   POST /periods/:id/close                finance.periods.close     (acknowledgeWarnings when open items remain)
|   POST /periods/:id/reopen               finance.periods.reopen    needs a written reason
|   GET  /reports/account-balances         finance.reports.view
|   GET  /reports/cash-book                finance.reports.view
*/
const router = Router();
const ctrl = () => container.resolve<LedgerController>("ledgerController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/accounts", ...guard("finance.accounts.view"), (q, s, n) => ctrl().listAccounts(q, s, n));
router.post("/accounts", ...guard("finance.accounts.manage"), validate(CreateAccountDto), (q, s, n) => ctrl().createAccount(q, s, n));
router.get("/accounts/:id", ...guard("finance.accounts.view"), (q, s, n) => ctrl().getAccount(q, s, n));
router.put("/accounts/:id", ...guard("finance.accounts.manage"), validate(UpdateAccountDto), (q, s, n) => ctrl().updateAccount(q, s, n));
router.post("/accounts/:id/deactivate", ...guard("finance.accounts.manage"), (q, s, n) => ctrl().deactivateAccount(q, s, n));
router.post("/accounts/:id/reactivate", ...guard("finance.accounts.manage"), (q, s, n) => ctrl().reactivateAccount(q, s, n));
router.delete("/accounts/:id", ...guard("finance.accounts.manage"), (q, s, n) => ctrl().deleteAccount(q, s, n));

router.get("/journals", ...guard("finance.journals.view"), (q, s, n) => ctrl().listJournals(q, s, n));
router.post("/journals", ...guard("finance.journals.post"), validate(ManualJournalDto), (q, s, n) => ctrl().postManual(q, s, n));
router.get("/journals/:id", ...guard("finance.journals.view"), (q, s, n) => ctrl().getJournal(q, s, n));
router.post("/journals/:id/reverse", ...guard("finance.journals.reverse"), validate(ReverseJournalDto), (q, s, n) => ctrl().reverse(q, s, n));

router.post("/opening-balances", ...guard("finance.journals.post"), validate(OpeningBalanceDto), (q, s, n) => ctrl().openingBalance(q, s, n));
router.post("/transfers", ...guard("finance.journals.post"), validate(TransferDto), (q, s, n) => ctrl().transfer(q, s, n));

router.get("/periods", ...guard("finance.periods.view"), (q, s, n) => ctrl().periods(q, s, n));
router.get("/periods/:id/close-checklist", ...guard("finance.periods.view"), (q, s, n) => ctrl().closeChecklist(q, s, n));
router.post("/periods/:id/close", ...guard("finance.periods.close"), validate(ClosePeriodDto), (q, s, n) => ctrl().closePeriod(q, s, n));
router.post("/periods/:id/reopen", ...guard("finance.periods.reopen"), validate(ReopenPeriodDto), (q, s, n) => ctrl().reopenPeriod(q, s, n));

router.get("/reports/account-balances", ...guard("finance.reports.view"), (q, s, n) => ctrl().accountBalances(q, s, n));
router.get("/reports/cash-book", ...guard("finance.reports.view"), (q, s, n) => ctrl().cashBook(q, s, n));

export default router;
