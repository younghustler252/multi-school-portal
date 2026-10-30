import { Router } from "express";
import { container } from "../../../container";
import { BankReconciliationController } from "../controllers/bank-reconciliation.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    ImportStatementDto, MatchDto, AutoMatchDto, CreateEntryDto, ClearBookLinesDto, CompleteReconciliationDto, ReopenReconciliationDto,
} from "../dtos/bank-reconciliation.dto";

/*
| BANK RECONCILIATION ROUTES (school realm, mounted at /finance/reconciliation). Every route needs the plan feature finance.bank_reconciliation.
|   GET    /accounts                  view      the bank accounts: lines imported, lines still unmatched, signed off through
|   GET    /statements                view      ?accountId
|   POST   /statements                import    CSV text or read lines
|   DELETE /statements/:id            import    only while none of its lines is matched
|   GET    /bank-lines                view      ?accountId&status=unmatched|matched|all&from&to&statementId
|   GET    /book-lines                view      the bank account's journal lines, same filters
|   GET    /suggestions               view      ?accountId&asOf  the best pairings, with the ambiguous ones flagged
|   POST   /auto-match                match     applies every unambiguous suggestion
|   POST   /matches                   match     { ledgerAccountId, bankLineIds[], journalLineIds[], note? }
|   DELETE /matches/:id               match     undo a pairing (also a recorded entry or a cleared item)
|   POST   /bank-lines/:id/entry      post      journal for a charge or interest the books missed, matched at once
|   POST   /book-lines/clear          post      set aside book entries that have no bank line, with a reason
|   GET    /summary                   view      ?accountId&periodId[&statementBalanceKobo]  the reconciliation statement for a month
|   GET    /reconciliations           view      ?accountId  the months signed off
|   POST   /reconciliations           complete  sign off a month
|   POST   /reconciliations/:id/reopen complete needs a written reason; only the latest month
*/
const router = Router();
const ctrl = () => container.resolve<BankReconciliationController>("bankReconciliationController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("finance.bank_reconciliation")] as const;

router.get("/accounts", ...guard("finance.bank_reconciliation.view"), (q, s, n) => ctrl().accounts(q, s, n));

router.get("/statements", ...guard("finance.bank_reconciliation.view"), (q, s, n) => ctrl().listStatements(q, s, n));
router.post("/statements", ...guard("finance.bank_reconciliation.import"), validate(ImportStatementDto), (q, s, n) => ctrl().importStatement(q, s, n));
router.delete("/statements/:id", ...guard("finance.bank_reconciliation.import"), (q, s, n) => ctrl().deleteStatement(q, s, n));

router.get("/bank-lines", ...guard("finance.bank_reconciliation.view"), (q, s, n) => ctrl().bankLines(q, s, n));
router.get("/book-lines", ...guard("finance.bank_reconciliation.view"), (q, s, n) => ctrl().bookLines(q, s, n));
router.get("/suggestions", ...guard("finance.bank_reconciliation.view"), (q, s, n) => ctrl().suggestions(q, s, n));

router.post("/auto-match", ...guard("finance.bank_reconciliation.match"), validate(AutoMatchDto), (q, s, n) => ctrl().autoMatch(q, s, n));
router.post("/matches", ...guard("finance.bank_reconciliation.match"), validate(MatchDto), (q, s, n) => ctrl().createMatch(q, s, n));
router.delete("/matches/:id", ...guard("finance.bank_reconciliation.match"), (q, s, n) => ctrl().removeMatch(q, s, n));

router.post("/bank-lines/:id/entry", ...guard("finance.bank_reconciliation.post"), validate(CreateEntryDto), (q, s, n) => ctrl().createEntry(q, s, n));
router.post("/book-lines/clear", ...guard("finance.bank_reconciliation.post"), validate(ClearBookLinesDto), (q, s, n) => ctrl().clearBookLines(q, s, n));

router.get("/summary", ...guard("finance.bank_reconciliation.view"), (q, s, n) => ctrl().summary(q, s, n));
router.get("/reconciliations", ...guard("finance.bank_reconciliation.view"), (q, s, n) => ctrl().listReconciliations(q, s, n));
router.post("/reconciliations", ...guard("finance.bank_reconciliation.complete"), validate(CompleteReconciliationDto), (q, s, n) => ctrl().complete(q, s, n));
router.post("/reconciliations/:id/reopen", ...guard("finance.bank_reconciliation.complete"), validate(ReopenReconciliationDto), (q, s, n) => ctrl().reopen(q, s, n));

export default router;
