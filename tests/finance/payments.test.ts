/*
|--------------------------------------------------------------------------
| PAYMENTS (manual): allocation maths, recording cash/POS/transfer/cheque, confirmation by a second person, receipts.
| Logic only. Posting uses the REAL posting service over in-memory repositories.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setup as booksSetup } from "./posting.test";
import { PostingService } from "../../src/modules/ledger/services/posting.service";
import { planAllocation, planOverride, oldestFirst } from "../../src/modules/payments/domain/allocation.policy";
import { PaymentConfirmationService } from "../../src/modules/payments/services/payment-confirmation.service";
import { RecordPaymentUseCase, ConfirmPaymentUseCase, RejectPaymentUseCase, PreviewAllocationUseCase } from "../../src/modules/payments/usecases/payment-record.usecases";
import { ListPaymentsUseCase, GetPaymentUseCase, GetReceiptUseCase } from "../../src/modules/payments/usecases/payment-queries.usecases";
import { PaymentMapper } from "../../src/modules/payments/mappers/payment.mapper";
import { RecordPaymentDto, ConfirmPaymentDto, AllocationPreviewDto } from "../../src/modules/payments/dtos/payment.dto";
import { PAYMENTS_PERMISSIONS } from "../../src/modules/payments/payments.permissions";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import type { OpenInvoice, PaymentEntity } from "../../src/modules/payments/domain/payment.entity";
import type { FeeInvoiceEntity } from "../../src/modules/fees/domain/invoice.entity";

const code = (c: string) => (e: any) => e.code === c;
const N = (n: number) => BigInt(n) * 100n;
const day = (s: string) => new Date(`${s}T00:00:00Z`);

/* ── allocation policy ────────────────────────────────────────────────── */

const open = (id: string, studentId: string, balance: bigint, due: string | null, issued = "2026-09-01", number = id): OpenInvoice =>
    ({ id, studentId, invoiceNumber: number, dueDate: due ? day(due) : null, issueDate: day(issued), balanceKobo: balance, version: 1 });

describe("allocation policy", () => {
    const invs = [open("late", "s1", N(30_000), "2026-12-01"), open("early", "s2", N(50_000), "2026-10-01"), open("nodue", "s1", N(10_000), null)];

    it("orders by due date, no due date last, then issue date, then number", () => {
        assert.deepEqual(oldestFirst(invs).map(i => i.id), ["early", "late", "nodue"]);
        const a = open("a", "s", 1n, "2026-10-01", "2026-09-02", "INV-2"), b = open("b", "s", 1n, "2026-10-01", "2026-09-01", "INV-9"), c = open("c", "s", 1n, "2026-10-01", "2026-09-01", "INV-3");
        assert.deepEqual(oldestFirst([a, b, c]).map(i => i.id), ["c", "b", "a"]);
    });

    it("pays the oldest first and stops when the money runs out (a part payment)", () => {
        const plan = planAllocation(N(60_000), invs, ["s1", "s2"]);
        assert.deepEqual(plan.invoices.map(a => [a.invoiceId, a.amountKobo]), [["early", N(50_000)], ["late", N(10_000)]]);
        assert.equal(plan.creditKobo, 0n);
        assert.equal(plan.creditStudentId, null);
    });

    it("turns the rest into credit for the student of the last invoice paid (the brief's overpayment)", () => {
        const plan = planAllocation(N(100_000), invs, ["s1", "s2"]);
        assert.equal(plan.invoices.reduce((s, a) => s + a.amountKobo, 0n), N(90_000));
        assert.equal(plan.creditKobo, N(10_000));
        assert.equal(plan.creditStudentId, "s1");
    });

    it("with nothing owing, everything is credit for the chosen or first student", () => {
        assert.deepEqual(planAllocation(N(5_000), [], ["s1", "s2"]), { invoices: [], creditKobo: N(5_000), creditStudentId: "s1" });
        assert.equal(planAllocation(N(5_000), [], ["s1", "s2"], "s2").creditStudentId, "s2");
        assert.throws(() => planAllocation(N(5_000), [], []), code("STUDENTS_REQUIRED"));
        assert.throws(() => planAllocation(N(5_000), [], ["s1"], "stranger"), code("CREDIT_STUDENT_INVALID"));
    });

    it("an exact payment leaves no credit", () => {
        const plan = planAllocation(N(90_000), invs, ["s1", "s2"]);
        assert.equal(plan.creditKobo, 0n);
        assert.equal(plan.invoices.length, 3);
    });

    it("allocations never exceed the payment and an invoice never goes below zero", () => {
        const plan = planAllocation(N(70_000), invs, ["s1", "s2"]);
        assert.ok(plan.invoices.every(a => a.amountKobo > 0n));
        assert.equal(plan.invoices.reduce((s, a) => s + a.amountKobo, 0n) + plan.creditKobo, N(70_000));
    });

    it("an override is checked: known open invoices once each, within balance and within the payment", () => {
        const ok = planOverride(N(40_000), [{ invoiceId: "late", amountKobo: N(30_000) }], invs, ["s1"]);
        assert.equal(ok.creditKobo, N(10_000));
        assert.equal(ok.creditStudentId, "s1");
        assert.throws(() => planOverride(N(40_000), [{ invoiceId: "nope", amountKobo: 1n }], invs, ["s1"]), code("ALLOCATION_INVOICE_NOT_OPEN"));
        assert.throws(() => planOverride(N(99_000), [{ invoiceId: "late", amountKobo: N(30_001) }], invs, ["s1"]), code("ALLOCATION_EXCEEDS_BALANCE"));
        assert.throws(() => planOverride(N(10_000), [{ invoiceId: "late", amountKobo: N(20_000) }], invs, ["s1"]), code("ALLOCATION_EXCEEDS_PAYMENT"));
        assert.throws(() => planOverride(N(99_000), [{ invoiceId: "late", amountKobo: 1n }, { invoiceId: "late", amountKobo: 1n }], invs, ["s1"]), code("ALLOCATION_DUPLICATE_INVOICE"));
    });
});

/* ── use cases over in-memory repositories ────────────────────────────── */

const NOW = new Date("2026-10-20T10:00:00Z");

function world() {
    const books = booksSetup();
    const acct = (id: string, over: any = {}) => ({ id, code: id, name: id, type: "ASSET", subtype: "GENERAL", systemKey: null as any, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null, ...over });
    const accounts = [
        acct("a-cash", { systemKey: "CASH_DEFAULT", subtype: "CASH", isMoneyAccount: true }), acct("a-bank", { systemKey: "BANK_DEFAULT", subtype: "BANK", isMoneyAccount: true }),
        acct("a-petty", { subtype: "PETTY_CASH", isMoneyAccount: true }), acct("a-clearing", { systemKey: "ONLINE_CLEARING", subtype: "ONLINE_CLEARING", isMoneyAccount: true }),
        acct("a-recv", { systemKey: "FEES_RECEIVABLE" }), acct("a-advance", { systemKey: "ADVANCE_PAYMENTS", type: "LIABILITY" }), acct("a-rent", { type: "EXPENSE" }),
    ];
    books.deps.ledgerAccountRepository.findPostable = async (ids: string[], keys: string[]) => accounts.filter(a => a.isActive && (ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey))));
    const ledgerAccountRepository: any = {
        findById: async (id: string) => accounts.find(a => a.id === id) ?? null,
        findPostable: books.deps.ledgerAccountRepository.findPostable,
    };
    const posting = new PostingService(books.deps, books.options);

    const people = new Map([["s1", "Ada Obi"], ["s2", "Bayo Ade"], ["s3", "Chi Eze"]]);
    const guardians = new Map<string, string[]>([["g1", ["s1", "s2"]], ["g-none", []]]);
    const attachments = new Set(["att-1"]);
    const audit: any[] = [];

    const invoices = new Map<string, FeeInvoiceEntity>();
    const addInvoice = (id: string, studentId: string, total: bigint, due: string, over: any = {}) => {
        const inv: FeeInvoiceEntity = {
            id, invoiceNumber: `INV-${id}`, type: "TERM_FEES", status: "unpaid", studentId, studentName: people.get(studentId)!, admissionNumber: null,
            sessionId: "sess", termId: "term", classId: null, branchId: null, sourceStructureId: null, issueDate: day("2026-09-01"), dueDate: day(due),
            subtotalKobo: total, discountKobo: 0n, adjustmentsKobo: 0n, totalKobo: total, paidKobo: 0n, balanceKobo: total, journalId: "j", note: null, version: 1,
            voidedAt: null, voidReason: null, createdAt: NOW, items: [], discounts: [], ...over,
        };
        invoices.set(id, inv); return inv;
    };
    const applyFails = new Set<string>();
    const feeInvoiceRepository: any = {
        async findOpenForStudents(ids: string[]) { return [...invoices.values()].filter(i => ids.includes(i.studentId) && (i.status === "unpaid" || i.status === "partial") && i.balanceKobo > 0n); },
        async findManyByIds(ids: string[]) { return ids.map(i => invoices.get(i)).filter(Boolean); },
        async applyPayment(id: string, version: number, amount: bigint, status: "partial" | "paid") {
            const inv = invoices.get(id)!;
            if (applyFails.has(id) || inv.version !== version || inv.balanceKobo < amount) return false;
            inv.paidKobo += amount; inv.balanceKobo -= amount; inv.status = status; inv.version++;
            return true;
        },
    };

    const payments = new Map<string, PaymentEntity>();
    const allocations: any[] = [];
    const receipts = new Map<string, any>();
    let seq = 0;
    const paymentRepository: any = {
        async findById(id: string) {
            const p = payments.get(id); if (!p) return null;
            return { ...p, receiptNumber: receipts.get(id)?.receiptNumber ?? null, allocations: allocations.filter(a => a.paymentId === id).map((a, n) => ({ id: `al${n}`, invoiceId: a.invoiceId, invoiceNumber: a.invoiceId ? invoices.get(a.invoiceId)!.invoiceNumber : null, studentId: a.studentId, studentName: people.get(a.studentId) ?? null, amountKobo: a.amountKobo, reversedAt: null })) };
        },
        async findByClientRequestId(c: string) { const p = [...payments.values()].find(x => (x as any).clientRequestId === c); return p ? this.findById(p.id) : null; },
        async list(f: any) { const data = [...payments.values()].filter(p => !f.status || p.status === f.status); return { data, meta: { total: data.length, page: 1, limit: 20, totalPages: 1 } }; },
        async createPayment(data: any) {
            if (data.reference && [...payments.values()].some(p => p.reference === data.reference)) throw Object.assign(new Error("unique"), { code: "P2002", meta: { target: ["reference"] } });
            const p: any = { id: `pay-${++seq}`, version: 1, unallocatedKobo: 0n, confirmedById: null, confirmedAt: null, journalId: null, reversedAt: null, createdAt: NOW, receiptNumber: null, allocations: [], ...data };
            payments.set(p.id, p); return this.findById(p.id);
        },
        async markConfirmed(id: string, version: number, data: any) { const p = payments.get(id)!; if (p.version !== version || !["PENDING", "AWAITING_CONFIRMATION"].includes(p.status)) return false; Object.assign(p, data, { status: "CONFIRMED", version: version + 1 }); return true; },
        async markRejected(id: string, version: number, data: any) { const p = payments.get(id)!; if (p.version !== version || p.status !== "AWAITING_CONFIRMATION") return false; Object.assign(p, { confirmedById: data.confirmedById, confirmedAt: data.confirmedAt }, { status: "FAILED", version: version + 1 }); return true; },
        async addAllocations(rows: any[]) { allocations.push(...rows); },
        async createReceipt(r: any) { receipts.set(r.paymentId, r); },
        async findReceipt(id: string) { const r = receipts.get(id); return r ? { id: "r", receiptNumber: r.receiptNumber, paymentId: id, issuedAt: r.issuedAt, snapshot: r.snapshot } : null; },
    };
    const paymentContextRepository: any = {
        async guardianExists(id: string) { return guardians.has(id); },
        async guardianChildIds(id: string) { return guardians.get(id) ?? []; },
        async students(ids: string[]) { return ids.filter(i => people.has(i)).map(i => ({ id: i, name: people.get(i)! })); },
        async attachmentExists(id: string) { return attachments.has(id); },
        async schoolHeader() { return { name: "Greenfield College", address: "1 School Rd", logoUrl: null, principalName: "Mrs Ade" }; },
    };

    const mapper = new PaymentMapper();
    const confirmation = new PaymentConfirmationService({ paymentRepository, paymentContextRepository, feeInvoiceRepository, postingService: posting, numberSequenceService: books.deps.numberSequenceService } as any,
        { now: () => NOW, transaction: books.options.transaction });
    const d: any = { paymentRepository, paymentContextRepository, paymentConfirmationService: confirmation, ledgerAccountRepository, paymentMapper: mapper, auditService: { async log(p: any) { audit.push(p); } } };
    const options = { now: () => NOW, transaction: books.options.transaction };
    return { d, books, accounts, invoices, addInvoice, applyFails, payments, allocations, receipts, audit, record: new RecordPaymentUseCase(d, options), confirm: new ConfirmPaymentUseCase(d), reject: new RejectPaymentUseCase(d, { now: () => NOW }), preview: new PreviewAllocationUseCase(d) };
}

let w: ReturnType<typeof world>;
beforeEach(() => { w = world(); w.addInvoice("i1", "s1", N(60_000), "2026-10-15"); w.addInvoice("i2", "s2", N(40_000), "2026-11-15"); });
const rec = (over: any = {}) => w.record.execute("school-1", "bursar-1", { payerType: "GUARDIAN", guardianId: "g1", method: "cash", amountKobo: N(50_000), ...over });
const sum = (id: string, side: "debitKobo" | "creditKobo") => w.books.journals[0].lines.filter(l => l.accountId === id).reduce((s, l) => s + l[side], 0n);

describe("record a cash payment", () => {
    it("is confirmed at once: allocated oldest first, posted, receipted (the brief's part payment)", async () => {
        const { payment, duplicate } = await rec();
        assert.equal(duplicate, false);
        assert.equal(payment.status, "CONFIRMED");
        assert.equal(payment.receiptNumber, "RCT-2026-000001");
        assert.deepEqual(payment.allocations.map(a => [a.invoiceNumber, a.amountKobo]), [["INV-i1", Number(N(50_000))]]);
        const inv = w.invoices.get("i1")!;
        assert.equal(inv.status, "partial");
        assert.equal(inv.paidKobo, N(50_000));
        assert.equal(inv.balanceKobo, N(10_000));
        assert.equal(sum("a-cash", "debitKobo"), N(50_000));                              // debit the cash account
        assert.equal(sum("a-recv", "creditKobo"), N(50_000));                             // credit fees receivable
        assert.equal(w.books.journals[0].sourceType, "PAYMENT");
        assert.equal(w.audit[0].action, "payments.payment.recorded");
    });

    it("an overpayment pays everything owing and keeps the rest as credit (rule 3)", async () => {
        const { payment } = await rec({ amountKobo: N(110_000) });
        assert.equal(w.invoices.get("i1")!.status, "paid");
        assert.equal(w.invoices.get("i2")!.status, "paid");
        assert.equal(payment.unallocatedKobo, Number(N(10_000)));
        assert.equal(sum("a-cash", "debitKobo"), N(110_000));
        assert.equal(sum("a-recv", "creditKobo"), N(100_000));
        assert.equal(sum("a-advance", "creditKobo"), N(10_000));
        const credit = payment.allocations.find(a => a.isCredit)!;
        assert.equal(credit.studentId, "s2");                                               // the student of the last invoice paid
        assert.equal(w.books.journals[0].lines.find(l => l.accountId === "a-advance")!.partyId, "s2");
    });

    it("pays several children and posts one receivable line per student", async () => {
        await rec({ amountKobo: N(100_000) });
        const lines = w.books.journals[0].lines.filter(l => l.accountId === "a-recv");
        assert.deepEqual(lines.map(l => [l.partyId, l.creditKobo]), [["s1", N(60_000)], ["s2", N(40_000)]]);
    });

    it("the bursar can choose where it goes, and the rest becomes credit", async () => {
        const { payment } = await rec({ amountKobo: N(50_000), allocations: [{ invoiceId: "i2", amountKobo: N(30_000) }], creditStudentId: "s1" });
        assert.equal(w.invoices.get("i2")!.balanceKobo, N(10_000));
        assert.equal(w.invoices.get("i1")!.balanceKobo, N(60_000));
        assert.equal(payment.unallocatedKobo, Number(N(20_000)));
        assert.equal(payment.allocations.find(a => a.isCredit)!.studentId, "s1");
    });

    it("with nothing owing, the whole amount is credit", async () => {
        w.invoices.clear();
        const { payment } = await rec({ amountKobo: N(5_000) });
        assert.equal(payment.unallocatedKobo, Number(N(5_000)));
        assert.equal(sum("a-advance", "creditKobo"), N(5_000));
        assert.equal(w.books.journals[0].lines.length, 2);
    });

    it("freezes a receipt with the school, payer, lines and balance after", async () => {
        const { payment } = await rec();
        const r: any = await new GetReceiptUseCase(w.d).execute(payment.id);
        assert.equal(r.receiptNumber, "RCT-2026-000001");
        assert.equal(r.school.name, "Greenfield College");
        assert.equal(r.amountKobo, N(50_000).toString());
        assert.deepEqual(r.lines.map((l: any) => [l.invoiceNumber, l.studentName, l.amountKobo, l.balanceAfterKobo]), [["INV-i1", "Ada Obi", N(50_000).toString(), N(10_000).toString()]]);
        assert.equal(r.credit, null);
        await assert.rejects(() => new GetReceiptUseCase(w.d).execute("nope"), code("NOT_FOUND"));
    });

    it("receipt numbers run on", async () => {
        await rec({ amountKobo: N(10_000) });
        const second = (await rec({ amountKobo: N(10_000) })).payment;
        assert.equal(second.receiptNumber, "RCT-2026-000002");
    });
});

describe("record: choices and refusals", () => {
    it("POS goes to the bank account by default; cash to the cash account; a chosen money account is used", async () => {
        await rec({ method: "pos", amountKobo: N(1_000) });
        assert.equal(w.payments.get("pay-1")!.accountId, "a-bank");
        await rec({ method: "cash", amountKobo: N(1_000) });
        assert.equal(w.payments.get("pay-2")!.accountId, "a-cash");
        await rec({ method: "cash", amountKobo: N(1_000), accountId: "a-petty" });
        assert.equal(w.payments.get("pay-3")!.accountId, "a-petty");
    });

    it("refuses accounts that are not usable money accounts", async () => {
        for (const accountId of ["a-rent", "a-clearing", "nope"]) await assert.rejects(() => rec({ accountId }), code("PAYMENT_ACCOUNT_INVALID"));
        w.accounts.find(a => a.id === "a-petty")!.isActive = false;
        await assert.rejects(() => rec({ accountId: "a-petty" }), code("PAYMENT_ACCOUNT_INVALID"));
    });

    it("refuses a future date, an unknown guardian or student, and a guardian with no children and no students", async () => {
        await assert.rejects(() => rec({ paidOn: "2026-10-21" }), code("PAYMENT_DATE_IN_FUTURE"));
        await assert.rejects(() => rec({ guardianId: "nobody" }), code("NOT_FOUND"));
        await assert.rejects(() => rec({ studentIds: ["s1", "ghost"] }), code("STUDENT_NOT_FOUND"));
        await assert.rejects(() => rec({ guardianId: "g-none" }), code("STUDENTS_REQUIRED"));
        assert.equal(w.payments.size, 0);
    });

    it("a payment dated earlier is posted on that date", async () => {
        await rec({ paidOn: "2026-10-05" });
        assert.equal(w.books.journals[0].entryDate.toISOString().slice(0, 10), "2026-10-05");
    });

    it("the same client request id records once", async () => {
        const first = await rec({ clientRequestId: "click-0001" });
        const again = await rec({ clientRequestId: "click-0001" });
        assert.equal(again.duplicate, true);
        assert.equal(again.payment.id, first.payment.id);
        assert.equal(w.payments.size, 1);
        assert.equal(w.books.journals.length, 1);
    });

    it("a reference can be recorded only once", async () => {
        await rec({ reference: "POS-7788" });
        await assert.rejects(() => rec({ reference: "POS-7788" }), code("PAYMENT_REFERENCE_TAKEN"));
    });

    it("a payer who is a student or someone else must say which students", async () => {
        const { payment } = await rec({ payerType: "OTHER", guardianId: undefined, payerName: "Uncle Tunde", studentIds: ["s2"] });
        assert.equal(payment.allocations[0].studentId, "s2");
        assert.equal(w.invoices.get("i2")!.paidKobo, N(40_000));                          // paid the named student's invoice only
        assert.equal(w.invoices.get("i1")!.paidKobo, 0n);
    });
});

describe("transfers and cheques wait for a second person", () => {
    const transfer = (over: any = {}) => rec({ method: "bank_transfer", reference: "NIP-001", amountKobo: N(60_000), ...over });

    it("is saved awaiting confirmation with nothing posted and no invoice touched", async () => {
        const { payment } = await transfer();
        assert.equal(payment.status, "AWAITING_CONFIRMATION");
        assert.equal(payment.receiptNumber, null);
        assert.equal(payment.allocations.length, 0);
        assert.equal(w.books.journals.length, 0);
        assert.equal(w.invoices.get("i1")!.paidKobo, 0n);
    });

    it("needs a reference or a proof, and the proof must exist", async () => {
        await assert.rejects(() => rec({ method: "cheque", amountKobo: 1n }), code("PAYMENT_REFERENCE_NEEDED"));
        await rec({ method: "cheque", proofAttachmentId: "att-1", amountKobo: N(1_000) });
        await assert.rejects(() => rec({ method: "bank_transfer", proofAttachmentId: "gone", amountKobo: N(1_000) }), code("PAYMENT_ACCOUNT_INVALID"));
    });

    it("cannot be given an allocation until it is confirmed", async () => {
        await assert.rejects(() => transfer({ allocations: [{ invoiceId: "i1", amountKobo: 1n }] }), code("ALLOCATION_AT_CONFIRMATION"));
    });

    it("a different person confirms it and it is applied then, to the invoices as they are then", async () => {
        const { payment } = await transfer();
        w.addInvoice("i0", "s1", N(5_000), "2026-09-30");                                  // an older invoice issued meanwhile
        const done = await w.confirm.execute(payment.id, "school-1", "principal-1", {});
        assert.equal(done.status, "CONFIRMED");
        assert.equal(done.confirmedById, "principal-1");
        assert.deepEqual(done.allocations.map(a => [a.invoiceNumber, a.amountKobo]), [["INV-i0", Number(N(5_000))], ["INV-i1", Number(N(55_000))]]);
        assert.equal(sum("a-bank", "debitKobo"), N(60_000));
        assert.ok(done.receiptNumber);
        assert.equal(w.audit.at(-1).action, "payments.payment.confirmed");
    });

    it("the person who recorded it cannot confirm it", async () => {
        const { payment } = await transfer();
        await assert.rejects(() => w.confirm.execute(payment.id, "school-1", "bursar-1", {}), code("SELF_CONFIRMATION_NOT_ALLOWED"));
        assert.equal(w.payments.get(payment.id)!.status, "AWAITING_CONFIRMATION");
    });

    it("cannot be confirmed twice, or confirmed after rejection", async () => {
        const a = (await transfer()).payment;
        await w.confirm.execute(a.id, "school-1", "principal-1", {});
        await assert.rejects(() => w.confirm.execute(a.id, "school-1", "principal-2", {}), code("PAYMENT_NOT_WAITING"));
        const b = (await transfer({ reference: "NIP-002" })).payment;
        await w.reject.execute(b.id, "school-1", "principal-1", { reason: "Money never arrived" });
        assert.equal(w.payments.get(b.id)!.status, "FAILED");
        await assert.rejects(() => w.confirm.execute(b.id, "school-1", "principal-1", {}), code("PAYMENT_NOT_WAITING"));
        await assert.rejects(() => w.reject.execute(b.id, "school-1", "principal-1", { reason: "again" }), code("PAYMENT_NOT_WAITING"));
        assert.equal(w.books.journals.length, 1);                                             // only the confirmed one posted
    });

    it("the confirmer can choose the split", async () => {
        const { payment } = await transfer({ amountKobo: N(30_000) });
        const done = await w.confirm.execute(payment.id, "school-1", "principal-1", { allocations: [{ invoiceId: "i2", amountKobo: N(30_000) }] });
        assert.equal(w.invoices.get("i2")!.balanceKobo, N(10_000));
        assert.equal(done.unallocatedKobo, 0);
    });

    it("an invoice that changed meanwhile stops the confirmation", async () => {
        const { payment } = await transfer();
        w.applyFails.add("i1");
        await assert.rejects(() => w.confirm.execute(payment.id, "school-1", "principal-1", {}), code("INVOICE_CHANGED"));
    });
});

describe("preview, queries, requests and permissions", () => {
    it("previews without saving anything", async () => {
        const r = await w.preview.execute({ guardianId: "g1", amountKobo: N(70_000) });
        assert.deepEqual(r.invoices.map(i => [i.invoiceNumber, i.amountKobo, i.balanceAfterKobo]), [["INV-i1", Number(N(60_000)), 0], ["INV-i2", Number(N(10_000)), Number(N(30_000))]]);
        assert.equal(r.creditKobo, 0);
        assert.equal(w.payments.size, 0);
        assert.equal(w.invoices.get("i1")!.paidKobo, 0n);
        const over = await w.preview.execute({ studentIds: ["s1"], amountKobo: N(70_000) });
        assert.equal(over.creditKobo, Number(N(10_000)));
        assert.deepEqual(over.creditStudent, { id: "s1", name: "Ada Obi" });
        await assert.rejects(() => w.preview.execute({ guardianId: "nobody", amountKobo: 1n }), code("NOT_FOUND"));
    });

    it("lists summaries and returns one with its allocations", async () => {
        const { payment } = await rec();
        const list = await new ListPaymentsUseCase(w.d).execute({ status: "CONFIRMED" });
        assert.equal(list.data.length, 1);
        assert.ok(!("allocations" in list.data[0]));
        assert.equal((await new GetPaymentUseCase(w.d).execute(payment.id)).allocations.length, 1);
        await assert.rejects(() => new GetPaymentUseCase(w.d).execute("nope"), code("NOT_FOUND"));
    });

    it("validates requests", () => {
        const base = { method: "cash", amountKobo: 100, guardianId: "g" };
        assert.ok(RecordPaymentDto.safeParse(base).success);
        assert.ok(!RecordPaymentDto.safeParse({ ...base, guardianId: undefined }).success);                 // a guardian payer needs the guardian
        assert.ok(RecordPaymentDto.safeParse({ ...base, payerType: "OTHER", guardianId: undefined, studentIds: ["s"] }).success);
        assert.ok(!RecordPaymentDto.safeParse({ ...base, payerType: "OTHER", guardianId: undefined }).success);
        for (const bad of [0, -1, 1.5, "x"]) assert.ok(!RecordPaymentDto.safeParse({ ...base, amountKobo: bad }).success, String(bad));
        assert.ok(!RecordPaymentDto.safeParse({ ...base, method: "paystack" }).success);                    // online has its own path
        assert.ok(!RecordPaymentDto.safeParse({ ...base, extra: 1 }).success);
        assert.ok(RecordPaymentDto.safeParse({ ...base, amountKobo: "9007199254740993" }).success);
        assert.ok(ConfirmPaymentDto.safeParse({}).success);
        assert.ok(!AllocationPreviewDto.safeParse({ amountKobo: 1 }).success);
    });

    it("payment permissions are staff only; bursar records and confirms; principal only views; others nothing", () => {
        const keys = PAYMENTS_PERMISSIONS.map(p => p.key);
        for (const k of keys) assert.deepEqual([...PERMISSION_REGISTRY.find(p => p.key === k)!.personas], ["STAFF"]);
        const granted = (r: string) => ROLE_TEMPLATES.find(t => t.key === r)!.permissions.map(p => p.key);
        assert.deepEqual(keys.filter(k => granted("bursar").includes(k)), keys);
        assert.deepEqual(keys.filter(k => granted("principal").includes(k)), ["payments.view"]);
        for (const r of ["student", "guardian", "teacher"]) assert.ok(!granted(r).some(k => k.startsWith("payments.")));
    });
});
