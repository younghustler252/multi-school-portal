/*
|--------------------------------------------------------------------------
| FEES v2 reports and family views: ageing, defaulters, collections, statements, "my" views.
| Pure maths first, then the use cases over a small fake report repository.
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bucketOf, buildAgeing, buildCollections, buildStatement, daysOverdue, defaultersOf } from "../../src/modules/fees/domain/report.policy";
import { AgeingReportUseCase, DefaultersReportUseCase, CollectionsReportUseCase, StatementUseCase, MyChildrenUseCase, MyInvoicesUseCase, MyStatementUseCase } from "../../src/modules/fees/usecases/fee-report.usecases";
import { AgeingQuery, CollectionsQuery, StatementQuery } from "../../src/modules/fees/dtos/report.dto";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import type { OpenInvoiceRow, CollectionRow, StatementSource } from "../../src/modules/fees/domain/report.entity";

const N = (n: number) => BigInt(n) * 100n;
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const code = (c: string) => (e: any) => e.code === c;

const open = (id: string, studentId: string, balance: bigint, due: string | null, over: Partial<OpenInvoiceRow> = {}): OpenInvoiceRow => ({
    id, invoiceNumber: `INV-${id}`, studentId, studentName: studentId === "s1" ? "Ada Obi" : "Bayo Ade", admissionNumber: null, classId: "c1", className: "JSS 1", branchId: null, termId: "t1",
    issueDate: day("2026-08-01"), dueDate: due ? day(due) : null, totalKobo: balance, balanceKobo: balance, ...over,
});

describe("ageing maths", () => {
    it("counts days past the due date, using the issue date when there is no due date", () => {
        assert.equal(daysOverdue("2026-10-20", day("2026-10-10"), null), 10);
        assert.equal(daysOverdue("2026-10-20", day("2026-10-25"), null), -5);
        assert.equal(daysOverdue("2026-10-20", null, day("2026-10-01")), 19);
        assert.equal(daysOverdue("2026-10-20", null, null), 0);
    });

    it("puts days into the five buckets at the edges", () => {
        assert.deepEqual([0, 1, 30, 31, 60, 61, 90, 91, -4].map(bucketOf), ["CURRENT", "DAYS_1_30", "DAYS_1_30", "DAYS_31_60", "DAYS_31_60", "DAYS_61_90", "DAYS_61_90", "OVER_90", "CURRENT"]);
    });

    it("adds up per student and in total, biggest overdue first", () => {
        const r = buildAgeing([
            open("a", "s1", N(10_000), "2026-10-25"),            // current
            open("b", "s1", N(20_000), "2026-10-10"),            // 10 days
            open("c", "s2", N(50_000), "2026-06-01"),            // 141 days
            open("d", "s2", N(0), "2026-06-01"),                 // paid: ignored
        ], "2026-10-20");
        assert.deepEqual(r.students.map(s => s.studentId), ["s2", "s1"]);
        assert.equal(r.students[1].totalKobo, N(30_000));
        assert.equal(r.students[1].overdueKobo, N(20_000));
        assert.equal(r.students[0].oldestDaysOverdue, 141);
        assert.deepEqual([r.totals.CURRENT, r.totals.DAYS_1_30, r.totals.OVER_90], [N(10_000), N(20_000), N(50_000)]);
        assert.equal(r.totalKobo, N(80_000));
        assert.equal(r.overdueKobo, N(70_000));
    });

    it("defaulters are the students with something overdue, and the minimum can be raised", () => {
        const r = buildAgeing([open("a", "s1", N(10_000), "2026-10-25"), open("b", "s2", N(500), "2026-10-10")], "2026-10-20");
        assert.deepEqual(defaultersOf(r).students.map(s => s.studentId), ["s2"]);
        assert.equal(defaultersOf(r, N(1_000)).students.length, 0);
        assert.equal(defaultersOf(r).totalKobo, N(500));
    });
});

describe("collections maths", () => {
    const rows: CollectionRow[] = [
        { id: "p1", method: "cash", amountKobo: N(30_000), paidOn: "2026-10-02", branchId: "b1", receiptNumber: "R1", byClass: [{ classId: "c1", className: "JSS 1", amountKobo: N(30_000) }], creditKobo: 0n },
        { id: "p2", method: "paystack", amountKobo: N(50_000), paidOn: "2026-10-02", branchId: null, receiptNumber: "R2", byClass: [{ classId: "c1", className: "JSS 1", amountKobo: N(20_000) }, { classId: "c2", className: "JSS 2", amountKobo: N(20_000) }], creditKobo: N(10_000) },
        { id: "p3", method: "cash", amountKobo: N(5_000), paidOn: "2026-11-03", branchId: "b1", receiptNumber: "R3", byClass: [{ classId: "c2", className: "JSS 2", amountKobo: N(5_000) }], creditKobo: 0n },
    ];
    it("groups by method, biggest first", () => {
        const r = buildCollections(rows, "method", "2026-10-01", "2026-11-30");
        assert.deepEqual(r.lines.map(l => [l.key, l.count, l.totalKobo]), [["paystack", 1, N(50_000)], ["cash", 2, N(35_000)]]);
        assert.equal(r.totalKobo, N(85_000));
        assert.equal(r.creditKobo, N(10_000));
        assert.equal(r.payments, 3);
    });
    it("groups by day and month in date order", () => {
        assert.deepEqual(buildCollections(rows, "day", "a", "b").lines.map(l => l.key), ["2026-10-02", "2026-11-03"]);
        assert.deepEqual(buildCollections(rows, "month", "a", "b").lines.map(l => [l.key, l.totalKobo]), [["2026-10", N(80_000)], ["2026-11", N(5_000)]]);
    });
    it("groups by campus with names, and by class with the credit kept shown on its own", () => {
        const b = buildCollections(rows, "branch", "a", "b", { branch: new Map([["b1", "Main campus"]]) });
        assert.deepEqual(b.lines.map(l => l.label), ["No campus", "Main campus"]);
        const c = buildCollections(rows, "class", "a", "b");
        assert.deepEqual(c.lines.map(l => [l.label, l.totalKobo]).sort(), [["JSS 1", N(50_000)], ["JSS 2", N(25_000)], ["Kept as credit", N(10_000)]].sort());
    });
});

describe("statement maths", () => {
    const src = (over: Partial<StatementSource> = {}): StatementSource => ({
        student: { id: "s1", name: "Ada Obi", admissionNumber: null },
        invoices: [{ id: "i1", invoiceNumber: "INV-1", issueDate: day("2026-09-01"), subtotalKobo: N(60_000), discountKobo: N(5_000), status: "partial", createdAt: day("2026-09-01") },
                   { id: "d", invoiceNumber: null, issueDate: null, subtotalKobo: N(9_999), discountKobo: 0n, status: "draft", createdAt: day("2026-09-02") }],
        adjustments: [{ id: "a1", invoiceNumber: "INV-1", type: "WAIVER", amountKobo: N(5_000), decidedAt: day("2026-09-20"), reason: "Staff child" }],
        payments: [{ paymentId: "p1", receiptNumber: "R1", method: "cash", paidAt: day("2026-09-10"), status: "CONFIRMED", amountKobo: N(70_000) }],
        refunds: [{ id: "r1", receiptNumber: "R1", paidAt: day("2026-10-05"), amountKobo: N(10_000) }],
        openBalanceKobo: 0n, creditKobo: 0n, ...over,
    });

    it("runs a balance: charges up, adjustments and payments down, a refund of credit back up; drafts never show", () => {
        const s = buildStatement(src(), null, null);
        assert.deepEqual(s.entries.map(e => [e.kind, e.amountKobo, e.balanceKobo]), [
            ["INVOICE", N(55_000), N(55_000)], ["PAYMENT", -N(70_000), -N(15_000)], ["ADJUSTMENT", -N(5_000), -N(20_000)], ["REFUND", N(10_000), -N(10_000)],
        ]);
        assert.deepEqual(s.totals, { chargedKobo: N(55_000), adjustedKobo: N(5_000), paidKobo: N(70_000), refundedKobo: N(10_000) });
        assert.equal(s.closingKobo, -N(10_000));                                           // below zero: in credit
    });

    it("a period rolls everything earlier into the opening balance", () => {
        const s = buildStatement(src(), "2026-09-15", "2026-09-30");
        assert.equal(s.openingKobo, -N(15_000));
        assert.deepEqual(s.entries.map(e => e.kind), ["ADJUSTMENT"]);
        assert.equal(s.entries[0].balanceKobo, -N(20_000));
        assert.equal(s.closingKobo, -N(20_000));
    });

    it("a reversed payment shows the payment and its reversal, netting to nothing", () => {
        const s = buildStatement(src({ adjustments: [], refunds: [], payments: [{ paymentId: "p", receiptNumber: "R9", method: "cash", paidAt: day("2026-09-10"), status: "REVERSED", amountKobo: N(20_000) }] }), null, null);
        assert.deepEqual(s.entries.map(e => e.kind), ["INVOICE", "PAYMENT", "REVERSAL"]);
        assert.equal(s.closingKobo, N(55_000));
    });
});

function fakeRepo() {
    const calls: any[] = [];
    const repo: any = {
        async openInvoices(f: any) { calls.push(["open", f]); return [open("a", "s1", N(10_000), "2026-10-10")]; },
        async confirmedPayments(from: Date, to: Date, branch?: string) { calls.push(["paid", from, to, branch]); return []; },
        async branchNames() { return new Map(); },
        async statementSource(id: string) { return id === "s1" ? { student: { id: "s1", name: "Ada Obi", admissionNumber: null }, invoices: [], adjustments: [], payments: [], refunds: [], openBalanceKobo: 0n, creditKobo: 0n } : null; },
        async childIdsOf(persona: string, id: string) { return persona === "STUDENT" ? [id] : id === "g1" ? ["s1", "s2"] : []; },
        async familyInvoices(ids: string[], one?: string) { calls.push(["inv", ids, one]); return [{ id: "i", invoiceNumber: "INV-1", studentId: "s1", studentName: "Ada Obi", status: "unpaid", type: "TERM_FEES", issueDate: day("2026-09-01"), dueDate: null, totalKobo: N(1), paidKobo: 0n, balanceKobo: N(1) }]; },
        async familySummary(ids: string[]) { return ids.map(id => ({ studentId: id, studentName: id, admissionNumber: null, className: null, owedKobo: N(10), overdueInvoices: 1, creditKobo: N(2) })); },
    };
    return { repo, calls };
}

describe("report use cases", () => {
    const NOW = new Date("2026-10-20T10:00:00Z");
    it("ageing and defaulters default to today in the school's zone, and answer money as numbers", async () => {
        const { repo } = fakeRepo();
        const r: any = await new AgeingReportUseCase({ feeReportRepository: repo }, { now: () => NOW }).execute(AgeingQuery.parse({}));
        assert.equal(r.asOf, "2026-10-20");
        assert.equal(r.students[0].overdueKobo, Number(N(10_000)));
        assert.equal(r.totals.DAYS_1_30, Number(N(10_000)));
        const d: any = await new DefaultersReportUseCase({ feeReportRepository: repo }, { now: () => NOW }).execute({ ...AgeingQuery.parse({ classId: "c1" }) });
        assert.equal(d.students.length, 1);
    });

    it("collections validate the dates and pass the campus on", async () => {
        const { repo, calls } = fakeRepo();
        const q = CollectionsQuery.parse({ from: "2026-10-01", to: "2026-10-31", groupBy: "day", branchId: "b1" });
        const r: any = await new CollectionsReportUseCase({ feeReportRepository: repo }).execute(q);
        assert.deepEqual([r.payments, r.totalKobo, r.groupBy], [0, 0, "day"]);
        assert.equal(calls[0][3], "b1");
        assert.throws(() => CollectionsQuery.parse({ from: "2026-11-01", to: "2026-10-01" }));
        assert.throws(() => CollectionsQuery.parse({ from: "2026-10-01" }));
        assert.throws(() => StatementQuery.parse({ from: "2026-11-01", to: "2026-10-01" }));
    });

    it("a statement for an unknown student is not found", async () => {
        const { repo } = fakeRepo();
        await assert.rejects(() => new StatementUseCase({ feeReportRepository: repo }).execute("nobody", {}), code("NOT_FOUND"));
        assert.equal(((await new StatementUseCase({ feeReportRepository: repo }).execute("s1", {})) as any).student.name, "Ada Obi");
    });

    it("a guardian sees only their own children; a student only themselves; anyone else nobody", async () => {
        const { repo, calls } = fakeRepo();
        const kids: any = await new MyChildrenUseCase({ feeReportRepository: repo }).execute({ persona: "GUARDIAN", personaEntityId: "g1" });
        assert.deepEqual(kids.children.map((c: any) => c.studentId), ["s1", "s2"]);
        assert.equal(kids.totalOwedKobo, Number(N(20)));
        assert.equal(kids.totalCreditKobo, Number(N(4)));
        assert.deepEqual(((await new MyChildrenUseCase({ feeReportRepository: repo }).execute({ persona: "STUDENT", personaEntityId: "s7" })) as any).children.map((c: any) => c.studentId), ["s7"]);
        assert.equal(((await new MyChildrenUseCase({ feeReportRepository: repo }).execute({ persona: "STAFF", personaEntityId: "x" })) as any).children.length, 0);

        const mine = new MyInvoicesUseCase({ feeReportRepository: repo });
        await mine.execute({ persona: "GUARDIAN", personaEntityId: "g1" });
        assert.deepEqual(calls.at(-1), ["inv", ["s1", "s2"], undefined]);
        await assert.rejects(() => mine.execute({ persona: "GUARDIAN", personaEntityId: "g1" }, "s9"), code("NOT_YOUR_CHILD"));
        const st = new MyStatementUseCase({ feeReportRepository: repo });
        assert.equal(((await st.execute({ persona: "GUARDIAN", personaEntityId: "g1" }, "s1", {})) as any).student.id, "s1");
        await assert.rejects(() => st.execute({ persona: "GUARDIAN", personaEntityId: "g1" }, "s9", {}), code("NOT_YOUR_CHILD"));
        await assert.rejects(() => st.execute({ persona: null, personaEntityId: null }, "s1", {}), code("NOT_YOUR_CHILD"));
    });
});

describe("report permissions", () => {
    const granted = (r: string) => ROLE_TEMPLATES.find(t => t.key === r)!.permissions.map(p => p.key);
    it("reports are for staff; the bursar and principal have them; families only have fees.view (own)", () => {
        assert.deepEqual([...PERMISSION_REGISTRY.find(p => p.key === "fees.reports.view")!.personas], ["STAFF"]);
        assert.ok(granted("bursar").includes("fees.reports.view") && granted("principal").includes("fees.reports.view"));
        for (const r of ["student", "guardian", "teacher"]) assert.ok(!granted(r).includes("fees.reports.view"));
        for (const r of ["student", "guardian"]) assert.ok(granted(r).includes("fees.view"));
    });
});
