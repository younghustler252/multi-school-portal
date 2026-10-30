import { Router } from "express";
import { container } from "../../../container";
import { ExpenseController } from "../controllers/expense.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { CreateExpenseDto, UpdateExpenseDto, SubmitExpenseDto, ApproveExpenseDto, RejectExpenseDto, VoidExpenseDto, PayExpenseDto, ReversePaymentDto } from "../dtos/expense.dto";

/*
| EXPENSE ROUTES (school realm, mounted at /expenses). Every route: authenticate, tenant, permission, expenses entitlement, validation.
|   GET  /reports/expenses        finance.reports.view  (?from, ?to, ?groupBy=account|vendor|month|term, ?vendorId, ?termId)
|   GET  /reports/creditors       finance.reports.view  (?asOf, ?vendorId) what the school owes suppliers, aged
|   GET  /petty-cash              expenses.view         (?from, ?to) the petty cash book
|   GET  /                        expenses.view         (?status, ?kind, ?vendorId, ?requestedById, ?from, ?to, ?q, ?overdue, ?page, ?limit)
|   POST /                        expenses.create       a draft (nothing is posted)
|   GET  /:id                     expenses.view         with its lines and payments
|   PUT  /:id, DELETE /:id        expenses.create       drafts and rejected ones only
|   POST /:id/submit              expenses.create       numbers it; approves itself under the threshold
|   POST /:id/approve, /reject    expenses.approve      by someone other than the requester; approval posts to the books
|   POST /:id/void                expenses.void         reverses every journal it made
|   POST /:id/payments            expenses.pay          pay a bill, in full or in part
|   POST /:id/payments/:paymentId/reverse   expenses.void   one payment of a bill
*/
const router = Router();
const ctrl = () => container.resolve<ExpenseController>("expenseController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.expenses")] as const;

router.get("/reports/expenses", ...guard("finance.reports.view"), (q, s, n) => ctrl().expenseReport(q, s, n));
router.get("/reports/creditors", ...guard("finance.reports.view"), (q, s, n) => ctrl().creditors(q, s, n));
router.get("/petty-cash", ...guard("expenses.view"), (q, s, n) => ctrl().pettyCash(q, s, n));
router.get("/", ...guard("expenses.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...guard("expenses.create"), validate(CreateExpenseDto), (q, s, n) => ctrl().create(q, s, n));
router.get("/:id", ...guard("expenses.view"), (q, s, n) => ctrl().get(q, s, n));
router.put("/:id", ...guard("expenses.create"), validate(UpdateExpenseDto), (q, s, n) => ctrl().update(q, s, n));
router.delete("/:id", ...guard("expenses.create"), (q, s, n) => ctrl().remove(q, s, n));
router.post("/:id/submit", ...guard("expenses.create"), validate(SubmitExpenseDto), (q, s, n) => ctrl().submit(q, s, n));
router.post("/:id/approve", ...guard("expenses.approve"), validate(ApproveExpenseDto), (q, s, n) => ctrl().approve(q, s, n));
router.post("/:id/reject", ...guard("expenses.approve"), validate(RejectExpenseDto), (q, s, n) => ctrl().reject(q, s, n));
router.post("/:id/void", ...guard("expenses.void"), validate(VoidExpenseDto), (q, s, n) => ctrl().voidExpense(q, s, n));
router.post("/:id/payments", ...guard("expenses.pay"), validate(PayExpenseDto), (q, s, n) => ctrl().pay(q, s, n));
router.post("/:id/payments/:paymentId/reverse", ...guard("expenses.void"), validate(ReversePaymentDto), (q, s, n) => ctrl().reversePayment(q, s, n));

export default router;
