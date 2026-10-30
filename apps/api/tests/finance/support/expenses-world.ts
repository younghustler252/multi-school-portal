/*
| An in-memory expenses world over the REAL posting service: vendors, expenses, payments and budgets are small fakes that obey the same rules
| the database does (versions, state moves, one reversal per payment).
*/
import { setup as booksSetup } from "../posting.test";
import { PostingService } from "../../../src/modules/ledger/services/posting.service";
import { ExpenseMapper } from "../../../src/modules/expenses/mappers/expense.mapper";
import { BudgetCheckService } from "../../../src/modules/expenses/services/budget-check.service";
import { ExpenseApprovalService } from "../../../src/modules/expenses/services/expense-approval.service";
import {
    CreateExpenseUseCase, UpdateExpenseUseCase, DeleteExpenseUseCase, SubmitExpenseUseCase, ApproveExpenseUseCase, RejectExpenseUseCase, VoidExpenseUseCase,
} from "../../../src/modules/expenses/usecases/expense-commands.usecases";
import { PayExpenseUseCase, ReverseExpensePaymentUseCase } from "../../../src/modules/expenses/usecases/expense-payments.usecases";
import type { BudgetEnforcement } from "../../../src/modules/expenses/domain/expense.policy";

export const NOW = new Date("2026-10-20T10:00:00Z");
export const N = (n: number) => BigInt(n) * 100n;
export const code = (c: string) => (e: any) => e.code === c;

export function expensesWorld(opts: { enforcement?: BudgetEnforcement } = {}) {
    const books = booksSetup();
    const acct = (id: string, over: any = {}) => ({ id, code: id, name: id, type: "ASSET", subtype: "GENERAL", systemKey: null as any, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null, ...over });
    const accounts = [
        acct("a-cash", { systemKey: "CASH_DEFAULT", subtype: "CASH", isMoneyAccount: true }), acct("a-bank", { systemKey: "BANK_DEFAULT", subtype: "BANK", isMoneyAccount: true }),
        acct("a-petty", { subtype: "PETTY_CASH", isMoneyAccount: true }), acct("a-clearing", { subtype: "ONLINE_CLEARING", isMoneyAccount: true }),
        acct("a-ap", { systemKey: "ACCOUNTS_PAYABLE", type: "LIABILITY" }), acct("a-vat", { systemKey: "VAT_RECEIVABLE", subtype: "RECEIVABLE", isLocked: true }), acct("a-tuition", { type: "INCOME" }),
        acct("a-stationery", { type: "EXPENSE" }), acct("a-fuel", { type: "EXPENSE" }), acct("a-old-exp", { type: "EXPENSE", isActive: false }),
    ];
    const findPostable = async (ids: string[], keys: string[]) => accounts.filter(a => a.isActive && (ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey))));
    books.deps.ledgerAccountRepository.findPostable = findPostable;
    const ledgerAccountRepository: any = {
        findById: async (id: string) => accounts.find(a => a.id === id) ?? null,
        findByIds: async (ids: string[]) => accounts.filter(a => ids.includes(a.id)),
        findPostable,
    };
    const posting = new PostingService(books.deps, books.options);
    const audit: any[] = [];
    const auditService = { async log(p: any) { audit.push(p); } };

    const vendors = new Map<string, any>([["v1", { id: "v1", name: "Bright Stationers", isActive: true }], ["v-off", { id: "v-off", name: "Closed Ltd", isActive: false }]]);
    const vendorRepository: any = { async findById(id: string) { return vendors.get(id) ?? null; } };

    // expenses
    const expenses = new Map<string, any>();
    let expN = 0, payN = 0, lineN = 0;
    const view = (e: any) => ({ ...e, lines: e.lines.map((l: any) => ({ ...l })), payments: e.payments.map((p: any) => ({ ...p })) });
    const expenseRepository: any = {
        async findById(id: string) { const e = expenses.get(id); return e ? view(e) : null; },
        async createDraft(data: any, lines: any[]) {
            const e = {
                id: `exp-${++expN}`, expenseNumber: null, paidKobo: 0n, status: "DRAFT", recurringExpenseId: null, submittedAt: null, approvedById: null, approvedAt: null, autoApproved: false,
                rejectedById: null, rejectedAt: null, rejectionReason: null, voidReason: null, voidedById: null, voidedAt: null, journalId: null, version: 1, createdAt: NOW,
                vendorName: data.vendorId ? vendors.get(data.vendorId)?.name ?? null : null, ...data,
                lines: lines.map(l => ({ id: `el-${++lineN}`, accountCode: null, accountName: null, ...l })), payments: [] as any[],
            };
            expenses.set(e.id, e); return view(e);
        },
        async updateEditable(id: string, version: number, data: any, lines: any[]) {
            const e = expenses.get(id);
            if (!e || e.version !== version || !["DRAFT", "REJECTED"].includes(e.status)) return false;
            Object.assign(e, data, { version: version + 1, vendorName: data.vendorId ? vendors.get(data.vendorId)?.name ?? null : null });
            e.lines = lines.map(l => ({ id: `el-${++lineN}`, accountCode: null, accountName: null, ...l })); return true;
        },
        async deleteEditable(id: string) { const e = expenses.get(id); if (!e || !["DRAFT", "REJECTED"].includes(e.status)) return false; expenses.delete(id); return true; },
        async transition(id: string, from: string[], version: number, data: any) {
            const e = expenses.get(id);
            if (!e || e.version !== version || !from.includes(e.status)) return false;
            Object.assign(e, data, { version: version + 1 }); return true;
        },
        async applyPaid(id: string, version: number, paid: bigint, status: string) {
            const e = expenses.get(id);
            if (!e || e.version !== version) return false;
            if (paid < 0n || paid > e.totalKobo) throw new Error("CHECK paid_within_total");
            Object.assign(e, { paidKobo: paid, status, version: version + 1 }); return true;
        },
        async createPayment(data: any) { expenses.get(data.expenseId).payments.push({ accountName: null, reversedAt: null, reversedById: null, reverseReason: null, createdAt: new Date(NOW.getTime() + ++payN), ...data }); },
        async markPaymentReversed(paymentId: string, data: any) {
            for (const e of expenses.values()) { const p = e.payments.find((x: any) => x.id === paymentId); if (p) { if (p.reversedAt) return false; Object.assign(p, data); return true; } }
            return false;
        },
        async recurringExists() { return false; },
        async termExists() { return true; },
        async branchExists() { return true; },
    };

    // budgets: a plain list of active lines
    const budgetLines: { accountId: string; name: string; plannedKobo: bigint; from: string; to: string }[] = [];
    const inRange = (d: Date, from: string, to: string) => { const s = d.toISOString().slice(0, 10); return s >= from && s <= to; };
    const budgetRepository: any = {
        async activeLimits(ids: string[], day: string) {
            return budgetLines.filter(b => ids.includes(b.accountId) && b.from <= day && b.to >= day)
                .map(b => ({ ledgerAccountId: b.accountId, accountName: b.accountId, budgetId: "b1", budgetName: b.name, termId: null, plannedKobo: b.plannedKobo, from: b.from, to: b.to }));
        },
        async netDebits(ids: string[], from: string, to: string) {
            const m = new Map<string, bigint>();
            for (const j of books.journals) if (inRange(j.entryDate, from, to)) for (const l of j.lines) if (ids.includes(l.accountId)) m.set(l.accountId, (m.get(l.accountId) ?? 0n) + l.debitKobo - l.creditKobo);
            return m;
        },
    };

    const expenseMapper = new ExpenseMapper();
    const tx = books.options.transaction;
    const o = { now: () => NOW, transaction: tx };
    const d: any = { expenseRepository, vendorRepository, ledgerAccountRepository, postingService: posting, numberSequenceService: books.deps.numberSequenceService, expenseMapper, auditService, budgetRepository };
    d.budgetCheckService = new BudgetCheckService(d, { enforcement: opts.enforcement });
    d.expenseApprovalService = new ExpenseApprovalService(d, { now: () => NOW });

    const world = {
        d, books, accounts, expenses, vendors, budgetLines, audit,
        create: new CreateExpenseUseCase(d, o), update: new UpdateExpenseUseCase(d, o), remove: new DeleteExpenseUseCase(d),
        submit: new SubmitExpenseUseCase(d, o), approve: new ApproveExpenseUseCase(d, o), reject: new RejectExpenseUseCase(d, o), voider: new VoidExpenseUseCase(d, o),
        pay: new PayExpenseUseCase(d, o), reversePayment: new ReverseExpensePaymentUseCase(d, o),

        balance(accountId: string): bigint {
            return books.journals.flatMap(j => j.lines).filter(l => l.accountId === accountId).reduce((s, l) => s + l.debitKobo - l.creditKobo, 0n);
        },
        draft(over: any = {}) {
            return world.create.execute("school-1", "clerk-1", {
                kind: "BILL", vendorId: "v1", description: "Exercise books", expenseDate: "2026-10-10", dueDate: "2026-10-30",
                lines: [{ ledgerAccountId: "a-stationery", amountKobo: N(80_000) }], ...over,
            });
        },
        /** a bill sent for approval (over the threshold, so it waits) */
        async pending(over: any = {}) { const x = await world.draft(over); return world.submit.execute(x.id, "school-1", "clerk-1", {}); },
        /** a bill that is approved and owed */
        async owed(over: any = {}) { const x = await world.pending(over); return world.approve.execute(x.id, "school-1", "principal-1", {}); },

        /* THE CONTROL (brief 12): accounts payable equals what live bills still owe, and the books balance. */
        assertControl(assert: any) {
            const owed = [...expenses.values()].filter(e => e.kind === "BILL" && ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(e.status)).reduce((s, e) => s + e.totalKobo - e.paidKobo, 0n);
            assert.equal(-world.balance("a-ap"), owed, "accounts payable must equal what the bills owe");
            for (const e of expenses.values()) {
                const live = e.payments.filter((p: any) => !p.reversedAt).reduce((s: bigint, p: any) => s + p.amountKobo, 0n);
                if (e.status !== "VOID") assert.equal(live, e.paidKobo, `payments on ${e.id} must equal what it shows paid`);
            }
            const sums = books.journals.reduce((s, j) => ({ d: s.d + j.lines.reduce((x, l) => x + l.debitKobo, 0n), c: s.c + j.lines.reduce((x, l) => x + l.creditKobo, 0n) }), { d: 0n, c: 0n });
            assert.equal(sums.d, sums.c, "the books must balance");
        },
    };
    return world;
}
