/*
| An in-memory fees + payments world over the REAL posting service, used by the tests that follow money through
| payments, credit, adjustments, refunds and reversal. Repositories are small fakes that obey the same rules the database does.
*/
import { setup as booksSetup } from "../posting.test";
import { PostingService } from "../../../src/modules/ledger/services/posting.service";
import { PaymentConfirmationService } from "../../../src/modules/payments/services/payment-confirmation.service";
import { CreditService } from "../../../src/modules/payments/services/credit.service";
import { RecordPaymentUseCase } from "../../../src/modules/payments/usecases/payment-record.usecases";
import { ApplyCreditUseCase, GetCreditUseCase } from "../../../src/modules/payments/usecases/credit.usecases";
import { RequestRefundUseCase, DecideRefundUseCase, PayRefundUseCase } from "../../../src/modules/payments/usecases/refund.usecases";
import { ReversePaymentUseCase } from "../../../src/modules/payments/usecases/payment-reverse.usecase";
import { PaymentProviderError } from "../../../src/infrastructure/payments/interfaces/payment.provider.interface";
import { InitializeOnlinePaymentUseCase, ConfirmOnlinePaymentUseCase, RecordSettlementUseCase } from "../../../src/modules/payments/usecases/online-payment.usecases";
import { RequestAdjustmentUseCase, DecideAdjustmentUseCase } from "../../../src/modules/fees/usecases/fee-adjustment.usecases";
import { IssueInvoiceUseCase, VoidInvoiceUseCase } from "../../../src/modules/fees/usecases/invoice-issue.usecases";
import { PaymentMapper } from "../../../src/modules/payments/mappers/payment.mapper";
import { RefundMapper } from "../../../src/modules/payments/mappers/refund.mapper";
import { FeeAdjustmentMapper } from "../../../src/modules/fees/mappers/fee-adjustment.mapper";
import { FeeInvoiceMapper } from "../../../src/modules/fees/mappers/fee-invoice.mapper";
import { issueLines } from "../../../src/modules/fees/domain/invoice.policy";
import type { FeeInvoiceEntity } from "../../../src/modules/fees/domain/invoice.entity";
import type { PaymentEntity, RefundEntity } from "../../../src/modules/payments/domain/payment.entity";
import type { AdjustmentEntity } from "../../../src/modules/fees/domain/adjustment.entity";

export const NOW = new Date("2026-10-20T10:00:00Z");
export const N = (n: number) => BigInt(n) * 100n;
export const day = (s: string) => new Date(`${s}T00:00:00Z`);
export const code = (c: string) => (e: any) => e.code === c;

export function feesWorld() {
    const books = booksSetup();
    const acct = (id: string, over: any = {}) => ({ id, code: id, name: id, type: "ASSET", subtype: "GENERAL", systemKey: null as any, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null, ...over });
    const accounts = [
        acct("a-cash", { systemKey: "CASH_DEFAULT", subtype: "CASH", isMoneyAccount: true }), acct("a-bank", { systemKey: "BANK_DEFAULT", subtype: "BANK", isMoneyAccount: true }),
        acct("a-clearing", { systemKey: "ONLINE_CLEARING", subtype: "ONLINE_CLEARING", isMoneyAccount: true }),
        acct("a-recv", { systemKey: "FEES_RECEIVABLE" }), acct("a-advance", { systemKey: "ADVANCE_PAYMENTS", type: "LIABILITY" }),
        acct("a-disc", { systemKey: "DISCOUNTS_ALLOWED", type: "EXPENSE" }), acct("a-fees", { systemKey: "BANK_CHARGES", type: "EXPENSE" }), acct("a-bad", { systemKey: "BAD_DEBT", type: "EXPENSE" }),
        acct("a-tuition", { type: "INCOME" }), acct("a-books", { type: "INCOME" }), acct("a-rent", { type: "EXPENSE" }),
    ];
    books.deps.ledgerAccountRepository.findPostable = async (ids: string[], keys: string[]) => accounts.filter(a => a.isActive && (ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey))));
    const ledgerAccountRepository: any = { findById: async (id: string) => accounts.find(a => a.id === id) ?? null, findPostable: books.deps.ledgerAccountRepository.findPostable };
    const posting = new PostingService(books.deps, books.options);

    const people = new Map([["s1", "Ada Obi"], ["s2", "Bayo Ade"]]);
    const guardians = new Map<string, string[]>([["g1", ["s1", "s2"]]]);
    const audit: any[] = [];
    const auditService = { async log(p: any) { audit.push(p); } };

    // invoices
    const invoices = new Map<string, FeeInvoiceEntity>();
    let itemSeq = 0;
    const addInvoice = async (id: string, studentId: string, items: [string, bigint][] = [["a-tuition", N(60_000)]], discount = 0n, over: any = {}) => {
        const subtotal = items.reduce((s, i) => s + i[1], 0n);
        const inv: FeeInvoiceEntity = {
            id, invoiceNumber: `INV-${id}`, type: "TERM_FEES", status: "unpaid", studentId, studentName: people.get(studentId)!, admissionNumber: null,
            sessionId: "sess", termId: "term", classId: null, branchId: null, sourceStructureId: null, issueDate: day("2026-09-01"), dueDate: day("2026-10-15"),
            subtotalKobo: subtotal, discountKobo: discount, adjustmentsKobo: 0n, totalKobo: subtotal - discount, paidKobo: 0n, balanceKobo: subtotal - discount, journalId: "j", note: null, version: 1,
            voidedAt: null, voidReason: null, createdAt: NOW, discounts: [],
            items: items.map(([incomeAccountId, amountKobo], n) => ({ id: `${id}-it${++itemSeq}`, feeTypeId: null, description: `Fee ${n + 1}`, incomeAccountId, amountKobo, sortOrder: n })), ...over,
        };
        invoices.set(id, inv);
        await posting.post({ entryDate: "2026-09-01", description: `Invoice ${id}`, sourceType: "FEE_INVOICE", sourceId: id, purpose: "ISSUE", lines: issueLines(inv) });
        return inv;
    };
    const feeInvoiceRepository: any = {
        // copies, as a database returns: a caller must not see another caller's changes through a shared object
        async findById(id: string) { const i = invoices.get(id); return i ? { ...i } : null; },
        async findManyByIds(ids: string[]) { return ids.map(i => invoices.get(i)).filter(Boolean).map(i => ({ ...i! })); },
        async findOpenForStudents(ids: string[]) { return [...invoices.values()].filter(i => ids.includes(i.studentId) && (i.status === "unpaid" || i.status === "partial") && i.balanceKobo > 0n).map(i => ({ ...i })); },
        async applyPayment(id: string, version: number, amount: bigint, status: "partial" | "paid") {
            const inv = invoices.get(id)!;
            if (inv.version !== version || inv.balanceKobo < amount || !["unpaid", "partial"].includes(inv.status)) return false;
            inv.paidKobo += amount; inv.balanceKobo -= amount; inv.status = status; inv.version++; return true;
        },
        async updateAmounts(id: string, version: number, data: any) {
            const inv = invoices.get(id)!;
            if (inv.version !== version || inv.status === "draft" || inv.status === "void") return false;
            const next = { ...inv, ...data };
            // what the database CHECKs enforce
            if (next.totalKobo !== next.subtotalKobo - next.discountKobo + next.adjustmentsKobo) throw new Error("CHECK total_adds_up");
            if (next.balanceKobo !== next.totalKobo - next.paidKobo) throw new Error("CHECK balance_adds_up");
            if ([next.totalKobo, next.paidKobo, next.balanceKobo].some((v: bigint) => v < 0n)) throw new Error("CHECK nonneg");
            Object.assign(inv, data, { version: version + 1 }); return true;
        },
        async addDiscountLine(invoiceId: string, label: string, amountKobo: bigint) { invoices.get(invoiceId)!.discounts.push({ id: `d${Math.random()}`, ruleId: null, feeTypeId: null, label, amountKobo }); },
        async markVoid(id: string, version: number, data: any) { const inv = invoices.get(id)!; if (inv.version !== version) return false; Object.assign(inv, data, { version: version + 1 }); return true; },
        async countPayments(id: string) { return allocations.filter(a => a.invoiceId === id && !a.reversedAt).length; },
    };

    // payments
    const payments = new Map<string, any>();
    const allocations: any[] = [];
    const receipts = new Map<string, any>();
    let payN = 0, allocN = 0;
    const view = (p: any): PaymentEntity => ({
        ...p, receiptNumber: receipts.get(p.id)?.receiptNumber ?? null,
        allocations: allocations.filter(a => a.paymentId === p.id).map(a => ({ id: a.id, invoiceId: a.invoiceId, invoiceNumber: a.invoiceId ? invoices.get(a.invoiceId)!.invoiceNumber : null, studentId: a.studentId, studentName: people.get(a.studentId) ?? null, amountKobo: a.amountKobo, reversedAt: a.reversedAt })),
    });
    const paymentRepository: any = {
        async findById(id: string) { const p = payments.get(id); return p ? view(p) : null; },
        async findByClientRequestId() { return null; },
        async findByReference(reference: string) { const p = [...payments.values()].find(x => x.reference === reference); return p ? view(p) : null; },
        async setGatewayResult(id: string, data: any) { Object.assign(payments.get(id), data); },
        async markFailed(id: string, version: number, data: any) { const p = payments.get(id); if (p.version !== version || !["PENDING", "AWAITING_CONFIRMATION"].includes(p.status)) return false; Object.assign(p, data, { status: "FAILED", version: version + 1 }); return true; },
        async createPayment(data: any) {
            const p = { id: `pay-${++payN}`, version: 1, unallocatedKobo: 0n, confirmedById: null, confirmedAt: null, journalId: null, reversedAt: null, createdAt: NOW, ...data };
            payments.set(p.id, p); return view(p);
        },
        async markConfirmed(id: string, version: number, data: any) { const p = payments.get(id); if (p.version !== version || !["PENDING", "AWAITING_CONFIRMATION"].includes(p.status)) return false; Object.assign(p, data, { status: "CONFIRMED", version: version + 1 }); return true; },
        async markReversed(id: string, version: number, data: any) { const p = payments.get(id); if (p.version !== version || p.status !== "CONFIRMED") return false; Object.assign(p, data, { status: "REVERSED", version: version + 1 }); return true; },
        async addAllocations(rows: any[]) { for (const r of rows) allocations.push({ id: `al-${++allocN}`, reversedAt: null, ...r }); },
        async createReceipt(r: any) { receipts.set(r.paymentId, r); },
        async creditRows(studentId: string) {
            return allocations.filter(a => a.studentId === studentId && a.invoiceId === null && !a.reversedAt && payments.get(a.paymentId).status === "CONFIRMED")
                .map(a => ({ allocationId: a.id, paymentId: a.paymentId, receiptNumber: receipts.get(a.paymentId)?.receiptNumber ?? null, amountKobo: a.amountKobo, availableKobo: a.amountKobo }));
        },
        async invoiceAllocations(invoiceId: string) { return allocations.filter(a => a.invoiceId === invoiceId && !a.reversedAt).reverse(); },
        async allocationsOfPayment(paymentId: string) { return allocations.filter(a => a.paymentId === paymentId && !a.reversedAt); },
        async setAllocationAmount(id: string, amount: bigint) { const i = allocations.findIndex(a => a.id === id); if (amount <= 0n) allocations.splice(i, 1); else allocations[i].amountKobo = amount; },
        async addCredit(paymentId: string, studentId: string, amount: bigint, createdById: string | null) {
            const ex = allocations.find(a => a.paymentId === paymentId && a.studentId === studentId && a.invoiceId === null && !a.reversedAt);
            if (ex) ex.amountKobo += amount; else allocations.push({ id: `al-${++allocN}`, paymentId, invoiceId: null, studentId, amountKobo: amount, createdById, reversedAt: null });
        },
        async adjustUnallocated(paymentId: string, delta: bigint) {
            const p = payments.get(paymentId); const next = p.unallocatedKobo + delta;
            if (next < 0n || next > p.amountKobo) throw new Error("CHECK unallocated_in_range");
            p.unallocatedKobo = next;
        },
        async reverseAllocations(paymentId: string, when: Date) { for (const a of allocations) if (a.paymentId === paymentId && !a.reversedAt) a.reversedAt = when; },
    };
    const paymentContextRepository: any = {
        async guardianExists(id: string) { return guardians.has(id); },
        async guardianChildIds(id: string) { return guardians.get(id) ?? []; },
        async students(ids: string[]) { return ids.filter(i => people.has(i)).map(i => ({ id: i, name: people.get(i)! })); },
        async attachmentExists() { return true; },
        async guardianContact(id: string) { return guardians.has(id) ? { email: "parent@example.com", name: "Mr Obi", phone: "0800" } : null; },
        async subaccountCode() { return "ACCT_sub1"; },
        async schoolHeader() { return { name: "Greenfield College", address: null, logoUrl: null, principalName: null }; },
    };

    // refunds
    const refunds = new Map<string, any>();
    let refN = 0;
    const refundView = (r: any): RefundEntity => ({ ...r, receiptNumber: receipts.get(r.paymentId)?.receiptNumber ?? null, studentName: people.get(r.studentId) ?? null });
    const OPEN = ["REQUESTED", "APPROVED"];
    const refundRepository: any = {
        async findById(id: string) { const r = refunds.get(id); return r ? refundView(r) : null; },
        async list() { const data = [...refunds.values()].map(refundView); return { data, meta: { total: data.length, page: 1, limit: 20, totalPages: 1 } }; },
        async create(data: any) { const r = { id: `ref-${++refN}`, status: "REQUESTED", payoutAccountId: null, decidedById: null, decidedAt: null, decisionNote: null, firstApprovedById: null, firstApprovedAt: null, paidAt: null, journalId: null, createdAt: NOW, ...data }; refunds.set(r.id, r); return refundView(r); },
        async recordFirstApproval(id: string, by: string, at: Date) { const r = refunds.get(id); if (r.status !== "REQUESTED" || r.firstApprovedById) return false; Object.assign(r, { firstApprovedById: by, firstApprovedAt: at }); return true; },
        async markDecided(id: string, data: any, status: string) { const r = refunds.get(id); if (r.status !== "REQUESTED") return false; Object.assign(r, data, { status }); return true; },
        async markPaid(id: string, data: any) { const r = refunds.get(id); if (r.status !== "APPROVED") return false; Object.assign(r, data, { status: "PAID" }); return true; },
        async openAmounts(studentId: string) { const m = new Map<string, bigint>(); for (const r of refunds.values()) if (r.studentId === studentId && OPEN.includes(r.status)) m.set(r.paymentId, (m.get(r.paymentId) ?? 0n) + r.amountKobo); return m; },
        async openAmountFor(paymentId: string, studentId: string) { return [...refunds.values()].filter(r => r.paymentId === paymentId && r.studentId === studentId && OPEN.includes(r.status)).reduce((s, r) => s + r.amountKobo, 0n); },
        async countForPayment(paymentId: string) { return [...refunds.values()].filter(r => r.paymentId === paymentId && r.status !== "REJECTED").length; },
    };

    // adjustments
    const adjustments = new Map<string, any>();
    let adjN = 0;
    const adjView = (a: any): AdjustmentEntity => {
        const inv = invoices.get(a.invoiceId)!;
        return { ...a, invoiceNumber: inv.invoiceNumber, studentId: inv.studentId, studentName: inv.studentName, itemDescription: inv.items.find(i => i.id === a.invoiceItemId)?.description ?? null };
    };
    const feeAdjustmentRepository: any = {
        async findById(id: string) { const a = adjustments.get(id); return a ? adjView(a) : null; },
        async list() { const data = [...adjustments.values()].map(adjView); return { data, meta: { total: data.length, page: 1, limit: 20, totalPages: 1 } }; },
        async create(data: any) { const a = { id: `adj-${++adjN}`, status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null, firstApprovedById: null, firstApprovedAt: null, journalId: null, createdAt: NOW, ...data }; adjustments.set(a.id, a); return adjView(a); },
        async recordFirstApproval(id: string, by: string, at: Date) { const a = adjustments.get(id); if (a.status !== "PENDING" || a.firstApprovedById) return false; Object.assign(a, { firstApprovedById: by, firstApprovedAt: at }); return true; },
        async markDecided(id: string, data: any, status: string) { const a = adjustments.get(id); if (a.status !== "PENDING") return false; Object.assign(a, data, { status }); return true; },
        async creditedOnItem(itemId: string) { return [...adjustments.values()].filter(a => a.invoiceItemId === itemId && a.type === "CREDIT_NOTE" && a.status === "APPROVED").reduce((s, a) => s + a.amountKobo, 0n); },
        async countApprovedForInvoice(invoiceId: string) { return [...adjustments.values()].filter(a => a.invoiceId === invoiceId && a.status === "APPROVED").length; },
    };

    // the gateway: what it was asked, and what it will say when asked about a reference
    const provider = {
        started: [] as any[], failToStart: false, answer: null as null | ((reference: string) => any),
        async initializeTransaction(p: any) { if (provider.failToStart) throw new PaymentProviderError("down", false); provider.started.push(p); return { authorizationUrl: `https://pay.test/${p.reference}`, accessCode: "ac", reference: p.reference }; },
        async verifyTransaction(reference: string) {
            const pay = [...payments.values()].find(x => x.reference === reference)!;
            return provider.answer ? provider.answer(reference) : { status: "success", reference, amountKobo: Number(pay.amountKobo), paidAt: NOW, channel: "card", customerEmail: "parent@example.com" };
        },
    };
    const mails: any[] = [];
    const paymentMapper = new PaymentMapper();
    const refundMapper = new RefundMapper();
    const feeAdjustmentMapper = new FeeAdjustmentMapper();
    const feeInvoiceMapper = new FeeInvoiceMapper();
    const tx = books.options.transaction;
    const opts = { now: () => NOW, transaction: tx };

    const confirmation = new PaymentConfirmationService({ paymentRepository, paymentContextRepository, feeInvoiceRepository, postingService: posting, numberSequenceService: books.deps.numberSequenceService } as any, opts);
    const creditService = new CreditService({ paymentRepository, refundRepository, feeInvoiceRepository, postingService: posting } as any, { now: () => NOW });
    const d: any = {
        paymentRepository, paymentContextRepository, paymentConfirmationService: confirmation, ledgerAccountRepository, paymentMapper, auditService, refundRepository, refundMapper,
        paymentProvider: provider, mailService: { async sendPaymentReceipt(p: any) { mails.push(p); } },
        creditService, feeInvoiceRepository, postingService: posting, feeAdjustmentRepository, feeAdjustmentMapper, feeInvoiceMapper, numberSequenceService: books.deps.numberSequenceService,
    };

    const world = {
        d, books, accounts, invoices, payments, allocations, receipts, refunds, adjustments, audit, addInvoice, people,
        record: new RecordPaymentUseCase(d, opts), applyCredit: new ApplyCreditUseCase(d, { transaction: tx }), getCredit: new GetCreditUseCase(d),
        requestRefund: new RequestRefundUseCase(d), decideRefund: new DecideRefundUseCase(d, { now: () => NOW }), payRefund: new PayRefundUseCase(d, opts),
        reverse: new ReversePaymentUseCase(d, opts), provider, mails,
        initOnline: new InitializeOnlinePaymentUseCase(d), confirmOnline: new ConfirmOnlinePaymentUseCase(d, { now: () => NOW }), settle: new RecordSettlementUseCase(d, { now: () => NOW }),
        requestAdjustment: new RequestAdjustmentUseCase(d), decideAdjustment: new DecideAdjustmentUseCase(d, opts),
        issue: new IssueInvoiceUseCase(d, opts), voider: new VoidInvoiceUseCase(d, opts),

        // account balance, debit minus credit, over every journal (a reversal's journal offsets what it reverses)
        balance(accountId: string): bigint {
            return books.journals.flatMap(j => j.lines).filter(l => l.accountId === accountId).reduce((s, l) => s + l.debitKobo - l.creditKobo, 0n);
        },
        pay(over: any = {}) { return world.record.execute("school-1", "bursar-1", { payerType: "GUARDIAN", guardianId: "g1", method: "cash", amountKobo: N(10_000), ...over }); },

        /* THE CONTROL (brief section 12): fees receivable always equals what open invoices owe, and advance payments equals the credit held. */
        assertControl(assert: any) {
            const owed = [...invoices.values()].filter(i => i.status !== "draft" && i.status !== "void").reduce((s, i) => s + i.balanceKobo, 0n);
            assert.equal(world.balance("a-recv"), owed, "fees receivable must equal the open invoice balances");
            const held = [...payments.values()].filter(p => p.status === "CONFIRMED").reduce((s, p) => s + p.unallocatedKobo, 0n);
            assert.equal(-world.balance("a-advance"), held, "advance payments must equal the unallocated money on confirmed payments");
            const credit = allocations.filter(a => a.invoiceId === null && !a.reversedAt && payments.get(a.paymentId).status === "CONFIRMED").reduce((s, a) => s + a.amountKobo, 0n);
            assert.equal(credit, held, "credit rows must equal the unallocated money");
            for (const inv of invoices.values()) {
                if (inv.status === "draft" || inv.status === "void") continue;
                const live = allocations.filter(a => a.invoiceId === inv.id && !a.reversedAt).reduce((s, a) => s + a.amountKobo, 0n);
                assert.equal(live, inv.paidKobo, `allocations on ${inv.id} must equal what it shows paid`);
                assert.equal(inv.balanceKobo, inv.totalKobo - inv.paidKobo);
            }
            const sums = books.journals.reduce((s, j) => ({ d: s.d + j.lines.reduce((x, l) => x + l.debitKobo, 0n), c: s.c + j.lines.reduce((x, l) => x + l.creditKobo, 0n) }), { d: 0n, c: 0n });
            assert.equal(sums.d, sums.c, "the books must balance");
        },
    };
    return world;
}
