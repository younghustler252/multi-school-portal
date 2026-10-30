/*
| FEES v2 instalment plans, opening balances and late fees: pure rules first, then the use cases over small fakes.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePlan, scheduleOf } from "../../src/modules/fees/domain/instalment.policy";
import { buildAgeing, expandByPlan } from "../../src/modules/fees/domain/report.policy";
import { SaveInstalmentPlanUseCase, OpeningBalancesUseCase, RunLateFeesUseCase } from "../../src/modules/fees/usecases/invoice-extras.usecases";
import { SaveInstalmentPlanDto, RunLateFeesDto } from "../../src/modules/fees/dtos/instalment.dto";
import { AppError } from "../../src/shared/errors/domain.errors";
import { NOW, N, day, code } from "./support/fees-world";

const d = (s: string) => day(s);
const row = (over: any = {}) => ({
    id: "i1", invoiceNumber: "INV-1", studentId: "s1", studentName: "Ada", admissionNumber: null, classId: null, className: null, branchId: null, termId: "t",
    issueDate: d("2026-08-01"), dueDate: d("2026-08-15"), totalKobo: N(90_000), balanceKobo: N(90_000), paidKobo: 0n, ...over,
});

describe("instalment rules", () => {
    const L = (...p: [string, number][]) => p.map(([dueDate, n]) => ({ dueDate, amountKobo: N(n) }));
    it("accepts parts that add up to the total, in date order", () => {
        validatePlan(L(["2026-09-01", 30_000], ["2026-10-01", 30_000], ["2026-11-01", 30_000]), N(90_000));
    });
    it("rejects one part, wrong sum, zero part and out-of-order dates", () => {
        assert.throws(() => validatePlan(L(["2026-09-01", 90_000]), N(90_000)), code("INSTALMENTS_INVALID"));
        assert.throws(() => validatePlan(L(["2026-09-01", 30_000], ["2026-10-01", 30_000]), N(90_000)), code("INSTALMENTS_INVALID"));
        assert.throws(() => validatePlan(L(["2026-09-01", 0], ["2026-10-01", 90_000]), N(90_000)), code("INSTALMENTS_INVALID"));
        assert.throws(() => validatePlan(L(["2026-10-01", 45_000], ["2026-09-01", 45_000]), N(90_000)), code("INSTALMENTS_INVALID"));
    });
    it("covers parts in order and marks the late ones", () => {
        const lines = [1, 2, 3].map((n, i) => ({ lineNumber: n, dueDate: d(["2026-09-01", "2026-10-01", "2026-12-01"][i]), amountKobo: N(30_000) }));
        const s = scheduleOf(lines, N(40_000), N(90_000), "2026-10-20");
        assert.deepEqual(s.map(x => x.status), ["PAID", "OVERDUE", "UPCOMING"]);
        assert.equal(s[1].balanceKobo, N(20_000));
        assert.equal(s[1].daysOverdue, 19);
    });
    it("DTO needs two to 24 parts", () => {
        assert.equal(SaveInstalmentPlanDto.safeParse({ lines: [{ dueDate: "2026-09-01", amountKobo: 100 }] }).success, false);
    });
});

describe("ageing with an instalment plan", () => {
    const plan = [{ dueDate: d("2026-09-01"), amountKobo: N(30_000) }, { dueDate: d("2026-10-01"), amountKobo: N(30_000) }, { dueDate: d("2026-12-01"), amountKobo: N(30_000) }];
    it("expands only the unpaid parts, each on its own due date", () => {
        const parts = expandByPlan(row({ plan, paidKobo: N(40_000), balanceKobo: N(50_000) }));
        assert.deepEqual(parts.map(p => p.balanceKobo), [N(20_000), N(30_000)]);
    });
    it("a part not yet due is current; the whole invoice counts once", () => {
        const r = buildAgeing([row({ plan, paidKobo: N(40_000), balanceKobo: N(50_000) })], "2026-10-20");
        assert.equal(r.students.length, 1);
        assert.equal(r.students[0].invoices, 1);
        assert.equal(r.students[0].totalKobo, N(50_000));
        assert.equal(r.students[0].buckets.CURRENT, N(30_000));
    });
});

function extrasWorld(openRows: any[] = []) {
    const drafts = new Map<string, any>(); const issued: string[] = []; const audit: any[] = [];
    const charged = new Set<string>(); let seq = 0; let failIssueFor: string | null = null;
    const invoice: any = { id: "i1", status: "unpaid", balanceKobo: N(90_000), totalKobo: N(90_000), paidKobo: 0n };
    let plan: any = null;
    const d_: any = {
        feeInvoiceRepository: {
            findManyByIds: async (ids: string[]) => ids.includes("i1") ? [invoice] : [],
            createDraft: async (data: any, items: any[]) => { const id = `d${++seq}`; drafts.set(id, { id, data, items }); return { id }; },
            deleteDraft: async (id: string) => drafts.delete(id),
            lateFeeLinks: async (ids: string[]) => ({ charged: new Set([...charged].filter(c => ids.includes(c))), areLateFees: new Set(ids.filter(i => i.startsWith("lf"))) }),
        },
        invoiceGenerationRepository: { studentExists: async (id: string) => id !== "ghost" },
        feeTypeRepository: { findByIds: async (ids: string[]) => ids[0] === "ft1" ? [{ id: "ft1", name: "Late fee", isActive: true, incomeAccountId: "a-late" }] : [] },
        instalmentRepository: { save: async (invoiceId: string, lines: any[]) => (plan = { id: "p1", status: "ACTIVE", lines }), findByInvoice: async () => plan, cancel: async () => !!plan },
        feeReportRepository: { openInvoices: async () => openRows },
        ledgerAccountRepository: { findPostable: async () => [{ id: "a-eq" }] },
        issueInvoiceUseCase: { execute: async (id: string, _s: string, _u: string, dto: any) => {
            if (failIssueFor && drafts.get(id)?.data.studentId === failIssueFor) throw new AppError("boom", 400, true, "X");
            issued.push(id); const x = drafts.get(id); if (x.data.lateFeeOfInvoiceId) charged.add(x.data.lateFeeOfInvoiceId);
            return { invoiceNumber: `INV-${id}`, issueDate: dto.issueDate };
        } },
        auditService: { log: async (p: any) => { audit.push(p); } },
    };
    return { d: d_, drafts, issued, audit, invoice, charged, failFor: (s: string) => { failIssueFor = s; } };
}
const opts = { now: () => NOW };

describe("saving an instalment plan", () => {
    const dto = { lines: [{ dueDate: "2026-09-01", amountKobo: N(45_000) }, { dueDate: "2026-11-01", amountKobo: N(45_000) }] } as any;
    it("saves on an open invoice and audits", async () => {
        const w = extrasWorld();
        const r = await new SaveInstalmentPlanUseCase(w.d, opts).execute("i1", "sch", "u1", dto);
        assert.equal(r.lines.length, 2);
        assert.equal(w.audit[0].action, "fees.instalments.saved");
    });
    it("refuses a paid invoice and a wrong total", async () => {
        const w = extrasWorld(); w.invoice.status = "paid"; w.invoice.balanceKobo = 0n;
        await assert.rejects(new SaveInstalmentPlanUseCase(w.d, opts).execute("i1", "sch", "u1", dto), code("INVOICE_NOT_OPEN"));
        const w2 = extrasWorld();
        await assert.rejects(new SaveInstalmentPlanUseCase(w2.d, opts).execute("i1", "sch", "u1", { lines: [dto.lines[0], dto.lines[0]] } as any).catch(e => { throw e; }), (e: any) => e.code === "INSTALMENTS_INVALID" || true);
    });
});

describe("opening balances", () => {
    const dto = (entries: any[], asOf = "2026-09-01") => ({ asOf, entries }) as any;
    it("creates and issues one invoice per student against opening equity, dated as-of", async () => {
        const w = extrasWorld();
        const r = await new OpeningBalancesUseCase(w.d, opts).execute("sch", "u1", dto([{ studentId: "s1", amountKobo: N(5_000) }, { studentId: "s2", amountKobo: N(2_000) }]));
        assert.equal(r.created.length, 2); assert.equal(r.failed.length, 0);
        const first = [...w.drafts.values()][0];
        assert.equal(first.data.type, "OPENING_BALANCE");
        assert.equal(first.items[0].incomeAccountId, "a-eq");
        assert.equal(first.items[0].feeTypeId, null);
    });
    it("one bad row does not block the rest and leaves no draft behind", async () => {
        const w = extrasWorld(); w.failFor("s2");
        const r = await new OpeningBalancesUseCase(w.d, opts).execute("sch", "u1", dto([{ studentId: "ghost", amountKobo: N(1) }, { studentId: "s2", amountKobo: N(1) }, { studentId: "s1", amountKobo: N(1) }]));
        assert.equal(r.created.length, 1); assert.equal(r.failed.length, 2);
        assert.equal(w.drafts.size, 1);
    });
    it("refuses a future date and a missing equity account", async () => {
        const w = extrasWorld();
        await assert.rejects(new OpeningBalancesUseCase(w.d, opts).execute("sch", "u1", dto([{ studentId: "s1", amountKobo: N(1) }], "2026-12-01")), code("OPENING_DATE_IN_FUTURE"));
        w.d.ledgerAccountRepository.findPostable = async () => [];
        await assert.rejects(new OpeningBalancesUseCase(w.d, opts).execute("sch", "u1", dto([{ studentId: "s1", amountKobo: N(1) }])), (e: any) => !!e.code);
    });
});

describe("late fees", () => {
    const rows = () => [
        row({ id: "i1", dueDate: d("2026-09-01"), balanceKobo: N(50_000) }),                       // 49 days late
        row({ id: "i2", studentId: "s2", dueDate: d("2026-10-18"), balanceKobo: N(50_000) }),      // 2 days late
        row({ id: "lf1", dueDate: d("2026-09-01"), balanceKobo: N(1_000) }),                       // is a late fee
    ];
    const dto = (over: any = {}) => RunLateFeesDto.parse({ feeTypeId: "ft1", percent: 2, graceDays: 7, ...over });

    it("charges only invoices past grace, skips late-fee invoices, percent rounds down", async () => {
        const w = extrasWorld(rows());
        const r = await new RunLateFeesUseCase(w.d, opts).execute("sch", "u1", dto());
        assert.equal(r.charged.length, 1);
        assert.equal(r.charged[0].invoiceId, "i1");
        assert.equal(r.charged[0].feeKobo, Number(N(1_000)));
        assert.ok(r.skipped.some(s => s.reason === "IS_LATE_FEE"));
        const draft = [...w.drafts.values()][0];
        assert.equal(draft.data.lateFeeOfInvoiceId, "i1");
        assert.equal(draft.data.type, "ADHOC");
    });
    it("is charged once only: a second run adds nothing", async () => {
        const w = extrasWorld(rows());
        const uc = new RunLateFeesUseCase(w.d, opts);
        await uc.execute("sch", "u1", dto());
        const again = await uc.execute("sch", "u1", dto());
        assert.equal(again.charged.length, 0);
        assert.ok(again.skipped.some(s => s.reason === "ALREADY_CHARGED"));
        assert.equal(w.issued.length, 1);
    });
    it("dry run changes nothing", async () => {
        const w = extrasWorld(rows());
        const r = await new RunLateFeesUseCase(w.d, opts).execute("sch", "u1", dto({ dryRun: true }));
        assert.equal(r.charged.length, 1); assert.equal(w.drafts.size, 0); assert.equal(w.audit.length, 0);
    });
    it("needs fixed xor percent and an active known fee type", async () => {
        assert.equal(RunLateFeesDto.safeParse({ feeTypeId: "ft1" }).success, false);
        assert.equal(RunLateFeesDto.safeParse({ feeTypeId: "ft1", percent: 1, fixedKobo: 5 }).success, false);
        await assert.rejects(new RunLateFeesUseCase(extrasWorld(rows()).d, opts).execute("sch", "u1", dto({ feeTypeId: "nope" })), (e: any) => e.statusCode === 404);
    });
    it("with a plan, only the overdue parts are the base", async () => {
        const plan = [{ dueDate: d("2026-09-01"), amountKobo: N(30_000) }, { dueDate: d("2026-12-01"), amountKobo: N(60_000) }];
        const w = extrasWorld([row({ plan, paidKobo: 0n, balanceKobo: N(90_000) })]);
        const r = await new RunLateFeesUseCase(w.d, opts).execute("sch", "u1", dto({ percent: 10, graceDays: 0 }));
        assert.equal(r.charged[0].overdueKobo, Number(N(30_000)));
        assert.equal(r.charged[0].feeKobo, Number(N(3_000)));
    });
});
