/*
|--------------------------------------------------------------------------
| FINANCE PHASE 3: expenses. Draft, submit, approve, pay, void, budgets, and the payable control.
| Logic only, over the real posting service (see support/expenses-world.ts).
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expensesWorld, N, code } from "./support/expenses-world";
import { CreateExpenseDto, PayExpenseDto, RejectExpenseDto } from "../../src/modules/expenses/dtos/expense.dto";
import { needsApproval, occurrence, nextRunAfter, statusAfterPayment } from "../../src/modules/expenses/domain/expense.policy";

describe("expenses: drafts", () => {
    it("a draft posts nothing and has no number", async () => {
        const w = expensesWorld();
        const x = await w.draft();
        assert.equal(x.status, "DRAFT");
        assert.equal(x.expenseNumber, null);
        assert.equal(w.books.journals.length, 0);
        assert.equal(x.totalKobo, 8_000_000);
    });

    it("refuses a bill with no vendor, an inactive vendor, a non expense account, a future date and a due date before the expense", async () => {
        const w = expensesWorld();
        await assert.rejects(w.draft({ vendorId: undefined }), code("VENDOR_REQUIRED"));
        await assert.rejects(w.draft({ vendorId: "v-off" }), code("VENDOR_INACTIVE"));
        await assert.rejects(w.draft({ vendorId: "nope" }), code("REFERENCE_NOT_FOUND"));
        await assert.rejects(w.draft({ lines: [{ ledgerAccountId: "a-tuition", amountKobo: N(1) }] }), code("EXPENSE_ACCOUNT_INVALID"));
        await assert.rejects(w.draft({ lines: [{ ledgerAccountId: "a-cash", amountKobo: N(1) }] }), code("EXPENSE_ACCOUNT_INVALID"));
        await assert.rejects(w.draft({ lines: [{ ledgerAccountId: "a-old-exp", amountKobo: N(1) }] }), code("EXPENSE_ACCOUNT_INVALID"));
        await assert.rejects(w.draft({ expenseDate: "2026-10-25" }), code("EXPENSE_DATE_IN_FUTURE"));
        await assert.rejects(w.draft({ dueDate: "2026-10-01" }), code("DUE_BEFORE_EXPENSE"));
    });

    it("edits with the right version only, and a stale version is refused", async () => {
        const w = expensesWorld();
        const x = await w.draft();
        const body = { description: "Exercise books and pens", expenseDate: "2026-10-10", vendorId: "v1", lines: [{ ledgerAccountId: "a-stationery", amountKobo: N(90_000) }] };
        const u = await w.update.execute(x.id, "school-1", "clerk-1", { version: 1, ...body });
        assert.equal(u.totalKobo, 9_000_000);
        await assert.rejects(w.update.execute(x.id, "school-1", "clerk-1", { version: 1, ...body }), code("STALE_VERSION"));
    });

    it("deletes a draft, but not a submitted expense", async () => {
        const w = expensesWorld();
        const a = await w.draft(); await w.remove.execute(a.id, "school-1", "clerk-1");
        assert.equal(w.expenses.size, 0);
        const b = await w.pending();
        await assert.rejects(w.remove.execute(b.id, "school-1", "clerk-1"), code("EXPENSE_NOT_EDITABLE"));
    });

    it("the request bodies are strict", () => {
        assert.equal(CreateExpenseDto.safeParse({ kind: "BILL", description: "x", expenseDate: "2026-10-10", lines: [{ ledgerAccountId: "a", amountKobo: 0 }] }).success, false);
        assert.equal(CreateExpenseDto.safeParse({ kind: "BILL", description: "x", expenseDate: "2026-10-10", lines: [{ ledgerAccountId: "a", amountKobo: 100 }], extra: 1 }).success, false);
        assert.equal(PayExpenseDto.safeParse({ amountKobo: 100, method: "magic" }).success, false);
        assert.equal(RejectExpenseDto.safeParse({}).success, false);
    });
});

describe("expenses: submit and approve", () => {
    it("a bill over the threshold waits for approval, gets a number, and posts nothing yet", async () => {
        const w = expensesWorld();
        const x = await w.pending();
        assert.equal(x.status, "PENDING_APPROVAL");
        assert.equal(x.expenseNumber, "EXP-2026-000001");
        assert.equal(w.books.journals.length, 0);
    });

    it("a small bill approves itself at submit and is owed at once", async () => {
        const w = expensesWorld();
        const x = await w.pending({ lines: [{ ledgerAccountId: "a-stationery", amountKobo: N(10_000) }] });
        assert.equal(x.status, "APPROVED");
        assert.equal(x.autoApproved, true);
        assert.equal(w.balance("a-ap"), -N(10_000));
        assert.equal(w.balance("a-stationery"), N(10_000));
    });

    it("approving a bill posts Dr expense / Cr accounts payable, and the requester cannot approve their own", async () => {
        const w = expensesWorld();
        const x = await w.pending();
        await assert.rejects(w.approve.execute(x.id, "school-1", "clerk-1", {}), code("SELF_APPROVAL_NOT_ALLOWED"));
        const a: any = await w.approve.execute(x.id, "school-1", "principal-1", {});
        assert.equal(a.status, "APPROVED");
        assert.equal(w.balance("a-stationery"), N(80_000));
        assert.equal(w.balance("a-ap"), -N(80_000));
        const credit = w.books.journals[0].lines.find(l => l.accountId === "a-ap")!;
        assert.equal(credit.partyType, "VENDOR"); assert.equal(credit.partyId, "v1");
        await assert.rejects(w.approve.execute(x.id, "school-1", "principal-1", {}), code("EXPENSE_NOT_PENDING"));
        w.assertControl(assert);
    });

    it("a direct expense is paid on approval from the chosen account, and refuses a clearing account or none", async () => {
        const w = expensesWorld();
        const direct = { kind: "DIRECT", vendorId: undefined, lines: [{ ledgerAccountId: "a-fuel", amountKobo: N(60_000) }] };
        const noAcct = await w.draft(direct);
        await assert.rejects(w.submit.execute(noAcct.id, "school-1", "clerk-1", {}), code("PAY_ACCOUNT_REQUIRED"));
        await assert.rejects(w.submit.execute(noAcct.id, "school-1", "clerk-1", { payFromAccountId: "a-clearing" }), code("PAYMENT_ACCOUNT_INVALID"));
        const x: any = await w.submit.execute(noAcct.id, "school-1", "clerk-1", { payFromAccountId: "a-petty" });
        assert.equal(x.status, "PENDING_APPROVAL");
        const a: any = await w.approve.execute(x.id, "school-1", "principal-1", {});
        assert.equal(a.status, "PAID");
        assert.equal(a.payments.length, 1);
        assert.equal(w.balance("a-petty"), -N(60_000));
        assert.equal(w.balance("a-fuel"), N(60_000));
        assert.equal(w.balance("a-ap"), 0n);
        w.assertControl(assert);
    });

    it("rejecting needs a reason, moves it to REJECTED, and the rejected expense can be edited and sent again", async () => {
        const w = expensesWorld();
        const x = await w.pending();
        await assert.rejects(w.reject.execute(x.id, "school-1", "clerk-1", { reason: "no" }), code("SELF_APPROVAL_NOT_ALLOWED"));
        await assert.rejects(w.reject.execute(x.id, "school-1", "principal-1", { reason: "   " }), code("REASON_REQUIRED"));
        const r: any = await w.reject.execute(x.id, "school-1", "principal-1", { reason: "Get three quotes" });
        assert.equal(r.status, "REJECTED"); assert.equal(r.rejectionReason, "Get three quotes");
        assert.equal(w.books.journals.length, 0);
        const u: any = await w.update.execute(x.id, "school-1", "clerk-1", { version: r.version, description: "Exercise books, cheaper", expenseDate: "2026-10-10", vendorId: "v1", lines: [{ ledgerAccountId: "a-stationery", amountKobo: N(70_000) }] });
        assert.equal(u.status, "DRAFT"); assert.equal(u.rejectionReason, null);
        const again: any = await w.submit.execute(x.id, "school-1", "clerk-1", {});
        assert.equal(again.status, "PENDING_APPROVAL");
    });

    it("numbers run on only when submitted", async () => {
        const w = expensesWorld();
        await w.draft();
        const a = await w.pending(); const b = await w.pending();
        assert.deepEqual([a.expenseNumber, b.expenseNumber], ["EXP-2026-000001", "EXP-2026-000002"]);
    });
});

describe("expenses: paying a bill", () => {
    it("pays in parts until paid, with the right status each time", async () => {
        const w = expensesWorld();
        const x: any = await w.owed();
        const p1: any = await w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(30_000), method: "bank_transfer" });
        assert.equal(p1.status, "PARTIALLY_PAID"); assert.equal(p1.balanceKobo, Number(N(50_000)));   // responses carry kobo as a JSON number
        assert.equal(w.balance("a-bank"), -N(30_000));
        const p2: any = await w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(50_000), method: "cash" });
        assert.equal(p2.status, "PAID"); assert.equal(p2.balanceKobo, 0);
        assert.equal(w.balance("a-cash"), -N(50_000));
        assert.equal(w.balance("a-ap"), 0n);
        w.assertControl(assert);
    });

    it("refuses an overpayment, a payment before approval, a future date, and a direct expense", async () => {
        const w = expensesWorld();
        const pend: any = await w.pending();
        await assert.rejects(w.pay.execute(pend.id, "school-1", "bursar-1", { amountKobo: N(1), method: "cash" }), code("EXPENSE_NOT_PAYABLE"));
        const x: any = await w.owed();
        await assert.rejects(w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(80_001), method: "cash" }), code("BILL_OVERPAYMENT"));
        await assert.rejects(w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(1), method: "cash", paidOn: "2026-10-25" }), code("PAYMENT_DATE_IN_FUTURE"));
        await assert.rejects(w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(1), method: "cash", paidOn: "2026-10-05" }), code("PAYMENT_BEFORE_EXPENSE"));
        const direct = await w.draft({ kind: "DIRECT", vendorId: undefined, payFromAccountId: "a-cash", lines: [{ ledgerAccountId: "a-fuel", amountKobo: N(5_000) }] });
        const s: any = await w.submit.execute(direct.id, "school-1", "clerk-1", {});
        await assert.rejects(w.pay.execute(s.id, "school-1", "bursar-1", { amountKobo: N(1), method: "cash" }), code("DIRECT_EXPENSE_PAID_ON_APPROVAL"));
    });

    it("the same request id twice pays once", async () => {
        const w = expensesWorld();
        const x: any = await w.owed();
        const body = { amountKobo: N(20_000), method: "cash" as const, requestId: "click-0001" };
        await w.pay.execute(x.id, "school-1", "bursar-1", body);
        const again: any = await w.pay.execute(x.id, "school-1", "bursar-1", body);
        assert.equal(again.paidKobo, Number(N(20_000)));
        assert.equal(w.balance("a-cash"), -N(20_000));
        w.assertControl(assert);
    });

    it("reversing one payment makes the bill owe it again, once only", async () => {
        const w = expensesWorld();
        const x: any = await w.owed();
        const p: any = await w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(80_000), method: "bank_transfer" });
        assert.equal(p.status, "PAID");
        const r: any = await w.reversePayment.execute(x.id, p.payments[0].id, "school-1", "bursar-1", { reason: "Transfer bounced" });
        assert.equal(r.status, "APPROVED"); assert.equal(r.paidKobo, 0);
        assert.equal(w.balance("a-bank"), 0n);
        await assert.rejects(w.reversePayment.execute(x.id, p.payments[0].id, "school-1", "bursar-1", { reason: "again" }), code("PAYMENT_ALREADY_REVERSED"));
        w.assertControl(assert);
    });
});

describe("expenses: void", () => {
    it("voiding a part paid bill reverses the payments and the accrual, and leaves nothing owed", async () => {
        const w = expensesWorld();
        const x: any = await w.owed();
        await w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(30_000), method: "cash" });
        const v: any = await w.voider.execute(x.id, "school-1", "principal-1", { reason: "Wrong supplier" });
        assert.equal(v.status, "VOID");
        for (const a of ["a-ap", "a-stationery", "a-cash"]) assert.equal(w.balance(a), 0n, a);
        assert.equal(w.books.journals.length, 4);
        await assert.rejects(w.voider.execute(x.id, "school-1", "principal-1", { reason: "twice" }), code("EXPENSE_NOT_VOIDABLE"));
        w.assertControl(assert);
    });

    it("voids a paid direct expense and puts the money back", async () => {
        const w = expensesWorld();
        const d = await w.draft({ kind: "DIRECT", vendorId: undefined, payFromAccountId: "a-cash", lines: [{ ledgerAccountId: "a-fuel", amountKobo: N(5_000) }] });
        const s: any = await w.submit.execute(d.id, "school-1", "clerk-1", {});
        assert.equal(s.status, "PAID");
        await w.voider.execute(s.id, "school-1", "principal-1", { reason: "Duplicate" });
        assert.equal(w.balance("a-cash"), 0n); assert.equal(w.balance("a-fuel"), 0n);
    });

    it("cannot void a draft or a pending expense", async () => {
        const w = expensesWorld();
        const a = await w.draft(); const b = await w.pending();
        await assert.rejects(w.voider.execute(a.id, "school-1", "principal-1", { reason: "x" }), code("EXPENSE_NOT_VOIDABLE"));
        await assert.rejects(w.voider.execute(b.id, "school-1", "principal-1", { reason: "x" }), code("EXPENSE_NOT_VOIDABLE"));
    });
});

describe("expenses: budgets", () => {
    const setBudget = (w: any, planned = N(100_000)) => w.budgetLines.push({ accountId: "a-stationery", name: "Term 1 budget", plannedKobo: planned, from: "2026-09-01", to: "2026-12-31" });

    it("warns when an approval takes an account past its budget, and still approves", async () => {
        const w = expensesWorld({ enforcement: "warn" });
        setBudget(w);
        const first: any = await w.owed();                                  // 80,000 of 100,000
        assert.equal(first.budgetWarnings.length, 0);
        const second = await w.pending();
        const a: any = await w.approve.execute(second.id, "school-1", "principal-1", {});
        assert.equal(a.status, "APPROVED");
        assert.equal(a.budgetWarnings.length, 1);
        assert.equal(a.budgetWarnings[0].overByKobo, Number(N(60_000)));
    });

    it("blocks, and nothing is posted, when enforcement is block", async () => {
        const w = expensesWorld({ enforcement: "block" });
        setBudget(w, N(50_000));
        const x = await w.pending();
        await assert.rejects(w.approve.execute(x.id, "school-1", "principal-1", {}), code("BUDGET_EXCEEDED"));
        assert.equal(w.books.journals.length, 0);
        assert.equal(w.expenses.get(x.id).status, "PENDING_APPROVAL");
    });

    it("an expense inside the budget gives no warning, and voiding frees the budget again", async () => {
        const w = expensesWorld({ enforcement: "block" });
        setBudget(w, N(100_000));
        const a: any = await w.owed();
        await w.voider.execute(a.id, "school-1", "principal-1", { reason: "Cancelled" });
        const b: any = await w.owed();
        assert.equal(b.status, "APPROVED");
    });
});

describe("expenses: rules and dates", () => {
    it("the threshold, status after payment and recurring dates", () => {
        assert.equal(needsApproval(N(49_999)), false);
        assert.equal(needsApproval(N(50_000)), true);
        assert.equal(statusAfterPayment(100n, 0n), "APPROVED");
        assert.equal(statusAfterPayment(100n, 40n), "PARTIALLY_PAID");
        assert.equal(statusAfterPayment(100n, 100n), "PAID");
        assert.equal(occurrence("2026-01-31", "MONTHLY", 1), "2026-02-28");
        assert.equal(occurrence("2026-01-31", "MONTHLY", 2), "2026-03-31");
        assert.equal(occurrence("2026-01-05", "WEEKLY", 2), "2026-01-19");
        assert.equal(nextRunAfter("2026-01-05", "MONTHLY", null), "2026-01-05");
        assert.equal(nextRunAfter("2026-01-05", "MONTHLY", "2026-01-05"), "2026-02-05");
    });
});
