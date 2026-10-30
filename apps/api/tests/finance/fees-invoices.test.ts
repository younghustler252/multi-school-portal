/*
|--------------------------------------------------------------------------
| FEES v2 invoices: discount maths, structure matching, generation (draft), edit, issue (posts to the books) and void.
| Logic only. Issue and void use the REAL posting service over in-memory repositories.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setup as booksSetup } from "./posting.test";
import { PostingService } from "../../src/modules/ledger/services/posting.service";
import { computeDiscounts, pickStructure, issueLines, invoiceNumber, totalsOf, statusAtIssue } from "../../src/modules/fees/domain/invoice.policy";
import { GenerateInvoicesUseCase, CreateInvoiceUseCase, UpdateDraftInvoiceUseCase, DeleteDraftInvoiceUseCase } from "../../src/modules/fees/usecases/invoice-drafts.usecases";
import { IssueInvoiceUseCase, BulkIssueInvoicesUseCase, VoidInvoiceUseCase } from "../../src/modules/fees/usecases/invoice-issue.usecases";
import { GetInvoiceUseCase, ListInvoicesUseCase } from "../../src/modules/fees/usecases/invoice-queries.usecases";
import { FeeInvoiceMapper } from "../../src/modules/fees/mappers/fee-invoice.mapper";
import { GenerateInvoicesDto, BulkIssueDto, UpdateDraftInvoiceDto, CreateInvoiceDto } from "../../src/modules/fees/dtos/invoice.dto";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import type { FeeStructureEntity } from "../../src/modules/fees/domain/fee.entity";
import type { DiscountInput, FeeInvoiceEntity } from "../../src/modules/fees/domain/invoice.entity";

const code = (c: string) => (e: any) => e.code === c;
const N = (n: number) => BigInt(n) * 100n;                   // naira to kobo

/* ── pure rules ───────────────────────────────────────────────────────── */

const items = [{ feeTypeId: "tuition", amountKobo: N(100_000) }, { feeTypeId: "books", amountKobo: N(20_000) }];
const pct = (value: number, feeTypeId: string | null = null, ruleId = "r"): DiscountInput => ({ ruleId, label: `${value / 100}%`, type: "PERCENT", value: BigInt(value), feeTypeId });
const fixed = (kobo: bigint, feeTypeId: string | null = null, ruleId = "f"): DiscountInput => ({ ruleId, label: "fixed", type: "FIXED", value: kobo, feeTypeId });

describe("discount maths", () => {
    it("takes a percentage of the whole bill, rounding down to a whole kobo", () => {
        assert.equal(computeDiscounts(items, [pct(1000)]).totalKobo, N(12_000));               // 10% of 120,000
        assert.equal(computeDiscounts([{ feeTypeId: null, amountKobo: 1001n }], [pct(3333)]).totalKobo, 333n);   // 333.63 -> 333
    });

    it("a rule for one fee type takes its share of that fee only", () => {
        const r = computeDiscounts(items, [pct(5000, "books")]);
        assert.equal(r.totalKobo, N(10_000));
        assert.equal(r.lines[0].feeTypeId, "books");
        assert.equal(computeDiscounts(items, [pct(5000, "transport")]).lines.length, 0);       // that fee is not on the bill
    });

    it("a fixed discount is capped at what it applies to", () => {
        assert.equal(computeDiscounts(items, [fixed(N(50_000), "books")]).totalKobo, N(20_000));
        assert.equal(computeDiscounts(items, [fixed(N(500_000))]).totalKobo, N(120_000));
    });

    it("stacked discounts never take more than the bill", () => {
        const r = computeDiscounts(items, [pct(6000, null, "a"), pct(6000, null, "b"), fixed(N(1), null, "c")]);
        assert.equal(r.totalKobo, N(120_000));
        assert.deepEqual(r.lines.map(l => l.amountKobo), [N(72_000), N(48_000)]);              // the third has nothing left to take
    });

    it("a fee-type rule cannot take from a fee already fully discounted", () => {
        const r = computeDiscounts(items, [fixed(N(20_000), "books", "a"), pct(5000, "books", "b")]);
        assert.deepEqual(r.lines.map(l => l.ruleId), ["a"]);
    });

    it("no rules, no lines", () => assert.deepEqual(computeDiscounts(items, []), { lines: [], totalKobo: 0n }));
});

const structure = (over: Partial<FeeStructureEntity> & { id: string }): FeeStructureEntity => ({
    name: "S", sessionId: "sess", termId: "term", classId: null, branchId: null, studentType: "ALL", dueDate: null, description: null,
    isActive: true, items: [], createdAt: new Date("2026-09-01"), deletedAt: null, ...over,
});

describe("structure matching", () => {
    const all = structure({ id: "all" });
    const jss1 = structure({ id: "jss1", classId: "jss1" });
    const jss1New = structure({ id: "jss1-new", classId: "jss1", studentType: "NEW" });
    const anyNew = structure({ id: "any-new", studentType: "NEW" });
    const campus = structure({ id: "campus", branchId: "b1" });

    it("the most specific structure wins", () => {
        const who = (classId: string, studentType: "NEW" | "RETURNING", branchId: string | null = null) => ({ classId, studentType, branchId });
        assert.equal(pickStructure([all, jss1, jss1New], who("jss1", "NEW"))?.id, "jss1-new");
        assert.equal(pickStructure([all, jss1, jss1New], who("jss1", "RETURNING"))?.id, "jss1");
        assert.equal(pickStructure([all, jss1, jss1New], who("jss2", "NEW"))?.id, "all");
        assert.equal(pickStructure([jss1, anyNew], who("jss1", "NEW"))?.id, "jss1");           // class beats student type
    });

    it("a campus structure only matches that campus", () => {
        assert.equal(pickStructure([campus], { classId: "x", studentType: "NEW", branchId: null }), null);
        assert.equal(pickStructure([campus], { classId: "x", studentType: "NEW", branchId: "b2" }), null);
        assert.equal(pickStructure([all, campus], { classId: "x", studentType: "NEW", branchId: "b1" })?.id, "campus");
    });

    it("ignores inactive structures and returns null when nothing fits", () => {
        assert.equal(pickStructure([structure({ id: "off", isActive: false })], { classId: "x", studentType: "NEW", branchId: null }), null);
        assert.equal(pickStructure([jss1], { classId: "jss2", studentType: "NEW", branchId: null }), null);
    });
});

describe("issue journal", () => {
    const inv = (over: any = {}) => ({
        studentId: "stu-1", totalKobo: N(110_000), discountKobo: N(10_000),
        items: [{ id: "1", feeTypeId: "t", description: "Tuition", incomeAccountId: "inc-tuition", amountKobo: N(100_000), sortOrder: 0 }, { id: "2", feeTypeId: "b", description: "Books", incomeAccountId: "inc-books", amountKobo: N(20_000), sortOrder: 1 }],
        ...over,
    });

    it("is the brief's example: receivable and discounts allowed against each income account", () => {
        const lines = issueLines(inv());
        assert.deepEqual(lines.map(l => [l.systemKey ?? l.accountId, l.debitKobo ?? 0n, l.creditKobo ?? 0n]), [
            ["FEES_RECEIVABLE", N(110_000), 0n], ["DISCOUNTS_ALLOWED", N(10_000), 0n], ["inc-tuition", 0n, N(100_000)], ["inc-books", 0n, N(20_000)],
        ]);
        assert.equal(lines[0].partyId, "stu-1");
        assert.equal(lines.reduce((s, l) => s + (l.debitKobo ?? 0n), 0n), lines.reduce((s, l) => s + (l.creditKobo ?? 0n), 0n));
    });

    it("has no receivable line when the discount covers everything", () => {
        const lines = issueLines(inv({ totalKobo: 0n, discountKobo: N(120_000) }));
        assert.ok(!lines.some(l => l.systemKey === "FEES_RECEIVABLE"));
        assert.equal(lines.length, 3);
    });

    it("numbers read INV-year-six digits; a bill with nothing to pay is issued as paid", () => {
        assert.equal(invoiceNumber("2026", 42), "INV-2026-000042");
        assert.equal(statusAtIssue(0n), "paid");
        assert.equal(statusAtIssue(1n), "unpaid");
        assert.deepEqual(totalsOf([{ amountKobo: 700n }, { amountKobo: 300n }], 250n),
            { subtotalKobo: 1000n, discountKobo: 250n, adjustmentsKobo: 0n, totalKobo: 750n, paidKobo: 0n, balanceKobo: 750n });
    });
});

/* ── use cases over in-memory repositories ────────────────────────────── */

const NOW = new Date("2026-10-20T10:00:00Z");
const TERM = { id: "term-1", sessionId: "sess-1", startDate: new Date("2026-09-14") };

function world() {
    const books = booksSetup();
    const accounts = ["FEES_RECEIVABLE", "DISCOUNTS_ALLOWED"].map(k => ({ id: `a-${k}`, code: k, name: k, type: "ASSET", subtype: "GENERAL", systemKey: k, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null }))
        .concat(["inc-tuition", "inc-books"].map(id => ({ id, code: id, name: id, type: "INCOME", subtype: "GENERAL", systemKey: null as any, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null })));
    books.deps.ledgerAccountRepository.findPostable = async (ids: string[], keys: string[]) => accounts.filter(a => a.isActive && (ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey))));
    const posting = new PostingService(books.deps, books.options);

    const audit: any[] = [];
    const invoices = new Map<string, FeeInvoiceEntity>();
    let seq = 0;
    const feeTypes = new Map<string, any>([
        ["ft-tuition", { id: "ft-tuition", name: "Tuition", incomeAccountId: "inc-tuition", isActive: true }],
        ["ft-books", { id: "ft-books", name: "Books", incomeAccountId: "inc-books", isActive: true }],
    ]);
    const structures: FeeStructureEntity[] = [
        structure({ id: "st-jss1", classId: "jss1", termId: TERM.id, dueDate: new Date("2026-11-01"), items: [
            { id: "i1", feeTypeId: "ft-tuition", feeTypeCode: "T", feeTypeName: "Tuition", amountKobo: N(100_000), sortOrder: 0 },
            { id: "i2", feeTypeId: "ft-books", feeTypeCode: "B", feeTypeName: "Books", amountKobo: N(20_000), sortOrder: 1 },
        ] }),
    ];
    const students = [
        { studentId: "stu-1", name: "Ada Obi", admissionNumber: "A1", classId: "jss1" },
        { studentId: "stu-2", name: "Bayo Ade", admissionNumber: "A2", classId: "jss1" },
        { studentId: "stu-3", name: "Chi Eze", admissionNumber: "A3", classId: "ss3" },          // no structure for ss3
    ];
    const discounts = new Map<string, DiscountInput[]>([["stu-1", [pct(1000, null, "sibling")]]]);
    const payments = new Map<string, number>();
    const mapper = new FeeInvoiceMapper();

    const feeInvoiceRepository: any = {
        async findById(id: string) { return invoices.get(id) ?? null; },
        async list(f: any) { const data = [...invoices.values()].filter(i => !f.status || i.status === f.status); return { data, meta: { total: data.length, page: 1, limit: 20, totalPages: 1 } }; },
        async draftIds(f: any) { return [...invoices.values()].filter(i => i.status === "draft" && (!f.termId || i.termId === f.termId)).map(i => i.id); },
        async liveStudentsForStructure(sid: string, ids: string[]) { return [...invoices.values()].filter(i => i.sourceStructureId === sid && ids.includes(i.studentId) && i.status !== "void").map(i => i.studentId); },
        async createDraft(data: any, its: any[], ds: any[]) {
            const inv: FeeInvoiceEntity = {
                id: `inv-${++seq}`, invoiceNumber: null, status: "draft", studentName: students.find(s => s.studentId === data.studentId)?.name ?? null, admissionNumber: null,
                sessionId: null, termId: null, classId: null, branchId: null, sourceStructureId: null, issueDate: null, dueDate: null, journalId: null, note: null,
                version: 1, voidedAt: null, voidReason: null, createdAt: NOW, ...data,
                items: its.map((i, n) => ({ id: `${seq}-i${n}`, ...i })), discounts: ds.map((d, n) => ({ id: `${seq}-d${n}`, ...d })),
            };
            invoices.set(inv.id, inv); return inv;
        },
        async replaceDraft(id: string, version: number, data: any, its: any[], ds: any[]) {
            const inv = invoices.get(id); if (!inv || inv.version !== version || inv.status !== "draft") return null;
            Object.assign(inv, data, { version: inv.version + 1, items: its.map((i, n) => ({ id: `n${n}`, ...i })), discounts: ds.map((d, n) => ({ id: `d${n}`, ...d })) });
            return inv;
        },
        async markIssued(id: string, version: number, data: any) { const inv = invoices.get(id); if (!inv || inv.version !== version || inv.status !== "draft") return false; Object.assign(inv, data, { version: version + 1 }); return true; },
        async markVoid(id: string, version: number, data: any) { const inv = invoices.get(id); if (!inv || inv.version !== version || inv.status === "draft" || inv.status === "void") return false; Object.assign(inv, data, { version: version + 1 }); return true; },
        async deleteDraft(id: string) { const inv = invoices.get(id); if (!inv || inv.status !== "draft") return false; invoices.delete(id); return true; },
        async countPayments(id: string) { return payments.get(id) ?? 0; },
    };
    const invoiceGenerationRepository: any = {
        async termInfo(id: string) { return id === TERM.id ? TERM : null; },
        async enrolledStudents(_t: string, f: any) { return students.filter(s => (!f.classId || s.classId === f.classId) && (!f.studentIds || f.studentIds.includes(s.studentId))); },
        async studentsWithEarlierEnrolment() { return new Set<string>(["stu-2"]); },
        async activeDiscounts(ids: string[]) { return new Map([...discounts].filter(([k]) => ids.includes(k))); },
        async studentExists(id: string) { return students.some(s => s.studentId === id); },
    };
    const feeStructureRepository: any = { async listFiltered() { return structures; } };
    const feeTypeRepository: any = { async findByIds(ids: string[]) { return ids.map(i => feeTypes.get(i)).filter(Boolean); } };

    const d: any = {
        feeInvoiceRepository, invoiceGenerationRepository, feeStructureRepository, feeTypeRepository, feeInvoiceMapper: mapper,
        postingService: posting, numberSequenceService: books.deps.numberSequenceService, auditService: { async log(p: any) { audit.push(p); } },
    };
    const issue = new IssueInvoiceUseCase(d, { now: () => NOW, transaction: books.options.transaction });
    d.issueInvoiceUseCase = issue;
    const voider = new VoidInvoiceUseCase(d, { now: () => NOW, transaction: books.options.transaction });
    return { d, books, invoices, audit, structures, feeTypes, discounts, payments, issue, voider };
}

let w: ReturnType<typeof world>;
beforeEach(() => { w = world(); });
const generate = (dto: any = {}) => new GenerateInvoicesUseCase(w.d).execute("school-1", "user-1", { termId: TERM.id, ...dto });

describe("generate draft invoices", () => {
    it("makes a draft per student with a structure, copies the fees and applies the student's discount", async () => {
        const r = await generate();
        assert.equal(r.created, 2);
        assert.deepEqual(r.withoutStructure.map(s => s.studentId), ["stu-3"]);
        const ada = [...w.invoices.values()].find(i => i.studentId === "stu-1")!;
        assert.equal(ada.status, "draft");
        assert.equal(ada.invoiceNumber, null);
        assert.equal(ada.subtotalKobo, N(120_000));
        assert.equal(ada.discountKobo, N(12_000));
        assert.equal(ada.totalKobo, N(108_000));
        assert.equal(ada.balanceKobo, N(108_000));
        assert.equal(ada.discounts[0].label, "10%");
        assert.deepEqual(ada.items.map(i => [i.description, i.incomeAccountId]), [["Tuition", "inc-tuition"], ["Books", "inc-books"]]);
        assert.equal(ada.dueDate?.toISOString().slice(0, 10), "2026-11-01");
        assert.equal(ada.sourceStructureId, "st-jss1");
        const bayo = [...w.invoices.values()].find(i => i.studentId === "stu-2")!;
        assert.equal(bayo.discountKobo, 0n);
        assert.equal(w.audit.at(-1).action, "fees.invoices.generated");
    });

    it("is safe to run again: nobody is billed twice", async () => {
        await generate();
        const again = await generate();
        assert.equal(again.created, 0);
        assert.equal(again.skippedExisting, 2);
        assert.equal(w.invoices.size, 2);
    });

    it("a student whose invoice was voided can be billed again", async () => {
        await generate();
        const first = [...w.invoices.values()][0];
        first.status = "void";
        const again = await generate();
        assert.equal(again.created, 1);
    });

    it("can be limited to a class or to named students, and the due date can be overridden", async () => {
        await generate({ classId: "ss3" });
        assert.equal(w.invoices.size, 0);
        await generate({ studentIds: ["stu-2"], dueDate: "2026-12-01" });
        assert.equal(w.invoices.size, 1);
        assert.equal([...w.invoices.values()][0].dueDate?.toISOString().slice(0, 10), "2026-12-01");
    });

    it("refuses an unknown term, and stops when a fee in the structure was deactivated", async () => {
        await assert.rejects(() => generate({ termId: "nope" }), code("NOT_FOUND"));
        w.feeTypes.get("ft-books").isActive = false;
        await assert.rejects(() => generate(), code("FEE_TYPE_INACTIVE"));
        assert.equal(w.invoices.size, 0);
    });

    it("reports a lost race as a skip, not a failure", async () => {
        const original = w.d.feeInvoiceRepository.createDraft;
        w.d.feeInvoiceRepository.createDraft = async (...a: any[]) => { if (a[0].studentId === "stu-1") throw Object.assign(new Error("unique"), { code: "P2002" }); return original(...a); };
        const r = await generate();
        assert.equal(r.created, 1);
        assert.equal(r.skippedExisting, 1);
    });
});

describe("hand-made and edited drafts", () => {
    it("makes a one-off draft with the fee type's name and income account", async () => {
        const r = await new CreateInvoiceUseCase(w.d).execute("s", "u", { studentId: "stu-2", type: "ADMISSION", items: [{ feeTypeId: "ft-tuition", amountKobo: N(5_000) }] });
        assert.equal(r.status, "draft");
        assert.equal(r.type, "ADMISSION");
        assert.equal(r.totalKobo, 500_000);
        assert.equal(r.items[0].description, "Tuition");
    });

    it("applies discounts only when the invoice belongs to a term", async () => {
        const create = (termId?: string) => new CreateInvoiceUseCase(w.d).execute("s", "u", { studentId: "stu-1", type: "ADHOC", termId, items: [{ feeTypeId: "ft-tuition", amountKobo: N(10_000) }] });
        assert.equal((await create()).discountKobo, 0);
        assert.equal((await create(TERM.id)).discountKobo, Number(N(1_000)));
    });

    it("refuses an unknown student, term or fee type", async () => {
        const base = { studentId: "stu-1", type: "ADHOC" as const, items: [{ feeTypeId: "ft-tuition", amountKobo: 100n }] };
        await assert.rejects(() => new CreateInvoiceUseCase(w.d).execute("s", "u", { ...base, studentId: "nobody" }), code("NOT_FOUND"));
        await assert.rejects(() => new CreateInvoiceUseCase(w.d).execute("s", "u", { ...base, termId: "nope" }), code("NOT_FOUND"));
        await assert.rejects(() => new CreateInvoiceUseCase(w.d).execute("s", "u", { ...base, items: [{ feeTypeId: "x", amountKobo: 1n }] }), code("NOT_FOUND"));
    });

    it("editing the fee lines works the discounts out again; a stale version is refused", async () => {
        await generate();
        const ada = [...w.invoices.values()].find(i => i.studentId === "stu-1")!;
        const update = (dto: any) => new UpdateDraftInvoiceUseCase(w.d).execute(ada.id, "s", "u", dto);
        const r = await update({ items: [{ feeTypeId: "ft-tuition", amountKobo: N(50_000) }], note: "agreed" });
        assert.equal(r.subtotalKobo, Number(N(50_000)));
        assert.equal(r.discountKobo, Number(N(5_000)));
        assert.equal(r.totalKobo, Number(N(45_000)));
        assert.equal(r.note, "agreed");
        await assert.rejects(() => update({ version: 1, note: "late" }), code("INVOICE_CHANGED"));
        await update({ version: r.version, dueDate: null });
    });

    it("only drafts can be edited or deleted", async () => {
        await generate();
        const ada = [...w.invoices.values()].find(i => i.studentId === "stu-1")!;
        await w.issue.execute(ada.id, "s", "u");
        await assert.rejects(() => new UpdateDraftInvoiceUseCase(w.d).execute(ada.id, "s", "u", { note: "x" }), code("INVOICE_NOT_DRAFT"));
        await assert.rejects(() => new DeleteDraftInvoiceUseCase(w.d).execute(ada.id, "s", "u"), code("INVOICE_NOT_DRAFT"));
        const bayo = [...w.invoices.values()].find(i => i.studentId === "stu-2")!;
        await new DeleteDraftInvoiceUseCase(w.d).execute(bayo.id, "s", "u");
        assert.ok(!w.invoices.has(bayo.id));
    });
});

describe("issue an invoice", () => {
    const ada = () => [...w.invoices.values()].find(i => i.studentId === "stu-1")!;

    it("numbers it, posts the journal from the brief, and marks it unpaid", async () => {
        await generate();
        const r = await w.issue.execute(ada().id, "school-1", "user-1", { issueDate: "2026-10-05" });
        assert.equal(r.invoiceNumber, "INV-2026-000001");
        assert.equal(r.status, "unpaid");
        assert.equal(r.issueDate, "2026-10-05");
        const j = w.books.journals[0];
        assert.equal(j.sourceType, "FEE_INVOICE");
        assert.equal(j.sourceId, ada().id);
        assert.equal(j.totalKobo, N(120_000));                                        // 108,000 receivable + 12,000 discount
        assert.equal(ada().journalId, j.id);
        const dr = (id: string) => j.lines.filter(l => l.accountId === id).reduce((s, l) => s + l.debitKobo, 0n);
        assert.equal(dr("a-FEES_RECEIVABLE"), N(108_000));
        assert.equal(dr("a-DISCOUNTS_ALLOWED"), N(12_000));
        assert.equal(j.lines.find(l => l.accountId === "a-FEES_RECEIVABLE")!.partyId, "stu-1");
        assert.equal(w.audit.at(-1).action, "fees.invoice.issued");
    });

    it("numbers run on across invoices and refuses to issue twice", async () => {
        await generate();
        const [a, b] = [...w.invoices.values()];
        assert.equal((await w.issue.execute(a.id, "s", "u", { issueDate: "2026-10-05" })).invoiceNumber, "INV-2026-000001");
        assert.equal((await w.issue.execute(b.id, "s", "u", { issueDate: "2026-10-05" })).invoiceNumber, "INV-2026-000002");
        await assert.rejects(() => w.issue.execute(a.id, "s", "u"), code("INVOICE_NOT_DRAFT"));
        assert.equal(w.books.journals.length, 2);
    });

    it("defaults to today and never allows a future date", async () => {
        await generate();
        const [a, b] = [...w.invoices.values()];
        assert.equal((await w.issue.execute(a.id, "s", "u")).issueDate, "2026-10-20");
        await assert.rejects(() => w.issue.execute(b.id, "s", "u", { issueDate: "2026-10-21" }), code("POSTING_DATE_IN_FUTURE"));
        assert.equal(w.invoices.get(b.id)!.status, "draft");
    });

    it("a closed month stops it and leaves the draft untouched", async () => {
        const closed = booksSetup({ closed: ["2026-09"] });
        w.books.deps.financePeriodRepository.findContaining = closed.deps.financePeriodRepository.findContaining;
        await generate();
        await assert.rejects(() => w.issue.execute(ada().id, "s", "u", { issueDate: "2026-09-10" }), code("PERIOD_CLOSED"));
        assert.equal(ada().status, "draft");
        assert.equal(ada().invoiceNumber, null);
    });

    it("an invoice that changed meanwhile is refused and nothing is kept", async () => {
        await generate();
        const inv = ada();
        const real = w.d.feeInvoiceRepository.markIssued;
        w.d.feeInvoiceRepository.markIssued = async () => false;                        // someone else got there first
        await assert.rejects(() => w.issue.execute(inv.id, "s", "u", { issueDate: "2026-10-05" }), code("INVOICE_CHANGED"));
        w.d.feeInvoiceRepository.markIssued = real;
        assert.equal(inv.status, "draft");
    });

    it("refuses an empty invoice and an unknown one", async () => {
        await assert.rejects(() => w.issue.execute("nope", "s", "u"), code("NOT_FOUND"));
        await generate();
        ada().subtotalKobo = 0n;
        await assert.rejects(() => w.issue.execute(ada().id, "s", "u"), code("INVOICE_HAS_NO_ITEMS"));
    });

    it("a fully discounted invoice is issued as paid, with no receivable", async () => {
        w.discounts.set("stu-1", [pct(10_000, null, "scholarship")]);
        await generate();
        const r = await w.issue.execute(ada().id, "s", "u", { issueDate: "2026-10-05" });
        assert.equal(r.status, "paid");
        assert.equal(r.balanceKobo, 0);
        assert.ok(!w.books.journals[0].lines.some(l => l.accountId === "a-FEES_RECEIVABLE"));
    });

    it("bulk issue reports what was issued and what failed, and carries on", async () => {
        await generate();
        const [a, b] = [...w.invoices.values()];
        b.subtotalKobo = 0n;                                                           // will fail
        const r = await new BulkIssueInvoicesUseCase({ ...w.d, issueInvoiceUseCase: w.issue }).execute("s", "u", { termId: TERM.id, issueDate: "2026-10-05" });
        assert.deepEqual(r.issued.map(x => x.id), [a.id]);
        assert.deepEqual(r.failed.map(x => [x.id, x.code]), [[b.id, "INVOICE_HAS_NO_ITEMS"]]);
    });
});

describe("void an invoice", () => {
    const ada = () => [...w.invoices.values()].find(i => i.studentId === "stu-1")!;
    const issued = async () => { await generate(); await w.issue.execute(ada().id, "s", "u", { issueDate: "2026-10-05" }); return ada(); };
    const generate2 = generate;

    it("reverses the journal and marks it void", async () => {
        const inv = await issued();
        const r = await w.voider.execute(inv.id, "school-1", "user-1", { reason: "Wrong class" });
        assert.equal(r.status, "void");
        assert.equal(r.voidReason, "Wrong class");
        assert.equal(w.books.journals.length, 2);
        assert.equal(w.books.journals[0].status, "REVERSED");
        assert.equal(w.books.journals[1].reversalOfId, w.books.journals[0].id);
        assert.equal(w.audit.at(-1).action, "fees.invoice.voided");
        void generate2;
    });

    it("refuses a draft, a void one, one with payments and one with adjustments", async () => {
        await generate();
        await assert.rejects(() => w.voider.execute(ada().id, "s", "u", { reason: "x" }), code("INVOICE_NOT_ISSUED"));
        const inv = await issued();
        w.payments.set(inv.id, 1);
        await assert.rejects(() => w.voider.execute(inv.id, "s", "u", { reason: "x" }), code("INVOICE_HAS_PAYMENTS"));
        w.payments.delete(inv.id);
        inv.adjustmentsKobo = -100n;
        await assert.rejects(() => w.voider.execute(inv.id, "s", "u", { reason: "x" }), code("INVOICE_HAS_ADJUSTMENTS"));
        inv.adjustmentsKobo = 0n;
        await w.voider.execute(inv.id, "s", "u", { reason: "ok" });
        await assert.rejects(() => w.voider.execute(inv.id, "s", "u", { reason: "again" }), code("INVOICE_ALREADY_VOID"));
    });

    it("a payment recorded on the invoice (paid amount) also blocks it", async () => {
        const inv = await issued();
        inv.paidKobo = 100n;
        await assert.rejects(() => w.voider.execute(inv.id, "s", "u", { reason: "x" }), code("INVOICE_HAS_PAYMENTS"));
    });
});

describe("queries, requests and permissions", () => {
    it("lists summaries without items and returns one with its lines", async () => {
        await generate();
        const list = await new ListInvoicesUseCase(w.d).execute({ status: "draft" });
        assert.equal(list.data.length, 2);
        assert.ok(!("items" in list.data[0]));
        const one = await new GetInvoiceUseCase(w.d).execute([...w.invoices.keys()][0]);
        assert.equal(one.items.length, 2);
        await assert.rejects(() => new GetInvoiceUseCase(w.d).execute("nope"), code("NOT_FOUND"));
    });

    it("validates requests", () => {
        assert.ok(GenerateInvoicesDto.safeParse({ termId: "t" }).success);
        assert.ok(!GenerateInvoicesDto.safeParse({ termId: "t", studentIds: [] }).success);
        assert.ok(!GenerateInvoicesDto.safeParse({ termId: "t", extra: 1 }).success);
        assert.ok(!BulkIssueDto.safeParse({}).success);
        assert.ok(BulkIssueDto.safeParse({ termId: "t" }).success && BulkIssueDto.safeParse({ invoiceIds: ["a"] }).success);
        assert.ok(!UpdateDraftInvoiceDto.safeParse({}).success);
        assert.ok(!CreateInvoiceDto.safeParse({ studentId: "s", type: "OPENING_BALANCE", items: [{ feeTypeId: "f", amountKobo: 1 }] }).success);
        assert.ok(!CreateInvoiceDto.safeParse({ studentId: "s", items: [{ feeTypeId: "f", amountKobo: 0 }] }).success);
    });

    it("invoice permissions are staff only; void is sensitive; the bursar cannot void", () => {
        const keys = ["fees.invoices.view", "fees.invoices.create", "fees.invoices.issue", "fees.invoices.void"];
        for (const k of keys) assert.deepEqual([...PERMISSION_REGISTRY.find(p => p.key === k)!.personas], ["STAFF"]);
        assert.equal(PERMISSION_REGISTRY.find(p => p.key === "fees.invoices.void")!.isSensitive, true);
        const granted = (r: string) => ROLE_TEMPLATES.find(t => t.key === r)!.permissions.map(p => p.key);
        assert.deepEqual(keys.filter(k => granted("bursar").includes(k)), keys.slice(0, 3));
        assert.deepEqual(keys.filter(k => granted("principal").includes(k)), ["fees.invoices.view"]);
        for (const r of ["student", "guardian", "teacher"]) assert.ok(!granted(r).some(k => k.startsWith("fees.invoices")));
    });
});
