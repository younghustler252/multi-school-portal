import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setup as booksSetup } from "./posting.test";
import { PostingService } from "../../src/modules/ledger/services/posting.service";
import { SettlementMapper } from "../../src/modules/gateway-settlements/mappers/settlement.mapper";
import { parseSettlementCsv, matchSettlements } from "../../src/modules/gateway-settlements/domain/settlement-report";
import {
    PreviewSettlementReportUseCase, RecordSettlementReportUseCase, SettlePaymentsUseCase, ListUnsettledUseCase, ReverseSettlementUseCase,
} from "../../src/modules/gateway-settlements/usecases/settlement.usecases";

const NOW = new Date("2026-10-20T10:00:00Z");
const N = (n: number) => BigInt(n) * 100n;
const code = (c: string) => (e: any) => e.code === c;

function world() {
    const books = booksSetup();
    const acct = (id: string, over: any = {}) => ({ id, code: id, name: id, type: "ASSET", subtype: "GENERAL", systemKey: null as any, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null, ...over });
    const accounts = [
        acct("a-bank", { subtype: "BANK", isMoneyAccount: true, systemKey: "BANK_DEFAULT" }), acct("a-clearing", { subtype: "ONLINE_CLEARING", isMoneyAccount: true, systemKey: "ONLINE_CLEARING" }),
        acct("a-charges", { type: "EXPENSE", systemKey: "BANK_CHARGES" }), acct("a-recv", { type: "ASSET" }),
    ];
    const findPostable = async (ids: string[], keys: string[]) => accounts.filter(a => a.isActive && (ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey))));
    books.deps.ledgerAccountRepository.findPostable = findPostable;
    const ledgerAccountRepository: any = { findById: async (id: string) => accounts.find(a => a.id === id) ?? null, findByIds: async (ids: string[]) => accounts.filter(a => ids.includes(a.id)), findPostable };
    const posting = new PostingService(books.deps, books.options);
    const audit: any[] = [];

    const payments = new Map<string, any>();
    const settlements = new Map<string, any>();
    const items = new Map<string, any>();   // paymentId -> item
    const facts = (p: any) => ({ id: p.id, reference: p.reference, gatewayReference: null, amountKobo: p.amountKobo, status: p.status, reversed: p.reversed, settled: items.has(p.id), paidAt: null, payerName: p.payerName });
    const clearingBalance = () => books.journals.flatMap(j => j.lines).filter(l => l.accountId === "a-clearing").reduce((s, l) => s + l.debitKobo - l.creditKobo, 0n);
    const settlementRepository: any = {
        async findPaymentsByReferences(refs: string[]) { return [...payments.values()].filter(p => refs.includes(p.reference)).map(facts); },
        async findPaymentsByIds(ids: string[]) { return ids.map(i => payments.get(i)).filter(Boolean).map(facts); },
        async listUnsettled() { const rows = [...payments.values()].filter(p => p.status === "CONFIRMED" && !p.reversed && !items.has(p.id)).map(facts); return { rows, total: rows.length, totalKobo: rows.reduce((s, r) => s + r.amountKobo, 0n) }; },
        async clearingBalance() { return clearingBalance(); },
        async findByReference(_p: string, ref: string) { return [...settlements.values()].find(s => s.reference === ref) ?? null; },
        async findById(id: string) { const s = settlements.get(id); return s ? { settlement: s, items: [...items.values()].filter(i => i.settlementId === id).map(i => ({ ...i, reference: payments.get(i.paymentId).reference, payerName: null })) } : null; },
        async list() { return { rows: [...settlements.values()], total: settlements.size }; },
        async insert(s: any, its: any[]) {
            if (its.some(i => items.has(i.paymentId))) return false;
            settlements.set(s.id, { ...s, accountName: s.accountId, journalNumber: null, itemCount: its.length, createdAt: NOW, reversedAt: null, reverseReason: null });
            for (const i of its) items.set(i.paymentId, { ...i, settlementId: s.id });
            return true;
        },
        async markReversed(id: string, _by: string, reason: string) { const s = settlements.get(id); if (s.reversedAt) return false; s.reversedAt = NOW; s.reverseReason = reason; return true; },
        async releaseItems(id: string) { for (const [k, v] of items) if (v.settlementId === id) items.delete(k); },
    };
    const d: any = { settlementRepository, ledgerAccountRepository, postingService: posting, settlementMapper: new SettlementMapper(), auditService: { async log(p: any) { audit.push(p); } } };
    const o = { now: () => NOW, transaction: books.options.transaction };
    const w = {
        d, books, settlements, items, audit, clearingBalance,
        preview: new PreviewSettlementReportUseCase(d), record: new RecordSettlementReportUseCase(d, o), settle: new SettlePaymentsUseCase(d, o),
        unsettled: new ListUnsettledUseCase(d), reverse: new ReverseSettlementUseCase(d, o),
        /** a confirmed online payment: Dr clearing, Cr receivable (what the real confirmation posts) */
        async pay(id: string, ref: string, amount: bigint, over: any = {}) {
            payments.set(id, { id, reference: ref, amountKobo: amount, status: "CONFIRMED", reversed: false, payerName: "Ada", ...over });
            await posting.post({ entryDate: "2026-10-10", description: `Online ${ref}`, sourceType: "MANUAL", sourceId: id, purpose: "ONLINE", lines: [{ accountId: "a-clearing", debitKobo: amount }, { accountId: "a-recv", creditKobo: amount }], actorUserId: "u1" });
        },
        bal: (a: string) => books.journals.flatMap(j => j.lines).filter(l => l.accountId === a).reduce((s, l) => s + l.debitKobo - l.creditKobo, 0n),
    };
    return w;
}

const REPORT = (rows: string[]) => `Settlement ID,Settlement Date,Reference,Amount,Fees\n${rows.join("\n")}\n`;

describe("settlement report parsing", () => {
    it("reads naira text, groups by settlement and derives the fee from a net column", () => {
        const a = parseSettlementCsv("Settlement ID,Paid At,Transaction Reference,Amount,Net\nS1,2026-10-12,R1,\"10,000.00\",9850.00\nS1,2026-10-12,R2,5000,4925\n");
        assert.equal(a.problems.length, 0);
        assert.deepEqual(a.rows.map(r => [r.settlementRef, r.reference, r.amountKobo, r.feeKobo]), [["S1", "R1", N(10_000), N(150)], ["S1", "R2", N(5_000), N(75)]]);
    });
    it("needs a settlement id column or a reference, and reports unreadable rows", () => {
        assert.deepEqual(parseSettlementCsv("Reference,Amount\nR1,100\n").missingColumns.length, 1);
        const p = parseSettlementCsv("Reference,Amount,Fees\nR1,100,1\nR2,abc,1\nR3,100,100\n", "S9");
        assert.equal(p.rows.length, 1);
        assert.equal(p.problems.length, 2);
    });
});

describe("settlement matching", () => {
    const pay = (over: any = {}) => ({ id: "p1", reference: "R1", gatewayReference: null, amountKobo: N(100), status: "CONFIRMED", reversed: false, settled: false, paidAt: null, payerName: null, ...over });
    const row = (over: any = {}) => ({ row: 2, settlementRef: "S1", settledOn: "2026-10-12", reference: "R1", amountKobo: N(100), feeKobo: N(2), ...over });
    it("a clean group", () => { const [g] = matchSettlements([row()], [pay()]); assert.equal(g.clean, true); assert.equal(g.netKobo, N(98)); });
    it("flags every kind of problem and never half-matches", () => {
        const cases: [any, any, string][] = [
            [row({ reference: "X" }), pay(), "NOT_FOUND"], [row(), pay({ reversed: true }), "REVERSED"], [row(), pay({ status: "PENDING" }), "NOT_CONFIRMED"],
            [row(), pay({ settled: true }), "ALREADY_SETTLED"], [row({ amountKobo: N(99) }), pay(), "AMOUNT_DIFFERS"], [row({ feeKobo: null }), pay(), "FEE_MISSING"],
        ];
        for (const [r, p, kind] of cases) { const [g] = matchSettlements([r], [p]); assert.equal(g.clean, false); assert.equal(g.problems[0].kind, kind); }
        const [d] = matchSettlements([row(), row({ row: 3 })], [pay()]);
        assert.equal(d.problems[0].kind, "DUPLICATE_IN_FILE");
    });
});

describe("gateway settlements: report", () => {
    let w: ReturnType<typeof world>;
    beforeEach(async () => { w = world(); await w.pay("p1", "R1", N(10_000)); await w.pay("p2", "R2", N(5_000)); });

    it("records a clean settlement: bank gets the net, charges get the fee, clearing is emptied", async () => {
        const csv = REPORT(["S1,2026-10-12,R1,10000.00,150.00", "S1,2026-10-12,R2,5000.00,75.00"]);
        const p = await w.preview.execute({ csv } as any);
        assert.equal(p.settlements[0].canRecord, true);
        const r = await w.record.execute("s", "u1", { csv } as any);
        assert.equal(r.recorded.length, 1);
        assert.equal(w.bal("a-bank"), N(14_775));
        assert.equal(w.bal("a-charges"), N(225));
        assert.equal(w.bal("a-clearing"), 0n);
        const u = await w.unsettled.execute({ page: 1, limit: 50 });
        assert.equal(u.data.length, 0);
        assert.equal(Number(u.differenceKobo), 0);
    });

    it("runs again harmlessly, and skips a settlement with a problem without touching the books", async () => {
        const csv = REPORT(["S1,2026-10-12,R1,10000.00,150.00", "S2,2026-10-13,R2,4000.00,10.00"]);
        const r = await w.record.execute("s", "u1", { csv } as any);
        assert.equal(r.recorded.length, 1);
        assert.equal(r.skipped[0].code, "SETTLEMENT_NOT_CLEAN");
        const again = await w.record.execute("s", "u1", { csv } as any);
        assert.equal(again.recorded.length, 0);
        assert.equal(w.bal("a-bank"), N(9_850));
    });

    it("refuses a bank account that is the clearing account", async () => {
        await assert.rejects(w.record.execute("s", "u1", { csv: REPORT(["S1,2026-10-12,R1,10000.00,1"]), accountId: "a-clearing" } as any), code("SETTLEMENT_INVALID"));
    });
});

describe("gateway settlements: by hand and reversal", () => {
    let w: ReturnType<typeof world>;
    beforeEach(async () => { w = world(); await w.pay("p1", "R1", N(10_000)); await w.pay("p2", "R2", N(5_000)); });

    it("settles chosen payments, shares the fee, and a payment is paid out once", async () => {
        const r = await w.settle.execute("s", "u1", { reference: "H1", paymentIds: ["p1", "p2"], feeKobo: N(225) } as any);
        assert.equal(Number(r.netKobo), Number(N(14_775)));
        const fees = [...w.items.values()].map(i => i.feeKobo).reduce((a, b) => a + b, 0n);
        assert.equal(fees, N(225));
        await assert.rejects(w.settle.execute("s", "u1", { reference: "H2", paymentIds: ["p1"], feeKobo: 0n } as any), code("SETTLEMENT_PAYMENTS_INVALID"));
        await assert.rejects(w.settle.execute("s", "u1", { reference: "H1", paymentIds: ["p1"], feeKobo: 0n } as any), (e: any) => ["SETTLEMENT_PAYMENTS_INVALID", "SETTLEMENT_ALREADY_RECORDED"].includes(e.code));
    });

    it("refuses reversed or unconfirmed payments and a fee that eats the amount", async () => {
        await w.pay("p3", "R3", N(100), { status: "PENDING" });
        await assert.rejects(w.settle.execute("s", "u1", { reference: "H3", paymentIds: ["p3"], feeKobo: 0n } as any), code("SETTLEMENT_PAYMENTS_INVALID"));
        await assert.rejects(w.settle.execute("s", "u1", { reference: "H4", paymentIds: ["p1"], feeKobo: N(10_000) } as any), code("SETTLEMENT_FEE_INVALID"));
    });

    it("reversing puts the money back in clearing and frees the payments", async () => {
        const r: any = await w.settle.execute("s", "u1", { reference: "H1", paymentIds: ["p1", "p2"], feeKobo: N(225) } as any);
        await assert.rejects(w.reverse.execute(r.id, "s", "u1", { reason: " " } as any), (e: any) => !!e);
        await w.reverse.execute(r.id, "s", "u1", { reason: "Wrong account" } as any);
        assert.equal(w.bal("a-clearing"), N(15_000));
        assert.equal(w.bal("a-bank"), 0n);
        assert.equal(w.items.size, 0);
        await assert.rejects(w.reverse.execute(r.id, "s", "u1", { reason: "again" } as any), code("SETTLEMENT_ALREADY_REVERSED"));
        await w.settle.execute("s", "u1", { reference: "H1-fixed", paymentIds: ["p1", "p2"], feeKobo: N(225) } as any);
        assert.equal(w.bal("a-clearing"), 0n);
    });
});
