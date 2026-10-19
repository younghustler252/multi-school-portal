/*
|--------------------------------------------------------------------------
| FINANCE: chart of accounts templates, their sync, and the new-school seed.
| Pure logic (no database): the sync and the seed run against small in-memory fakes.
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_SYSTEM_KEYS } from "../../src/modules/ledger/ledger.constants";
import {
    LEDGER_ACCOUNT_TEMPLATES, LedgerAccountTemplateDef, LedgerTemplateRow, LedgerTemplateDb,
    syncLedgerAccountTemplates, validateLedgerAccountTemplates,
} from "../../src/modules/ledger/ledger.templates";
import { monthlyPeriods, seedFinanceBooks } from "../../src/modules/ledger/ledger.provisioning";

const names = (ps: { name: string }[]) => [ps[0].name, ps[11].name];

describe("account templates registry", () => {
    it("is valid", () => assert.deepEqual(validateLedgerAccountTemplates(), []));

    it("has the 17 system accounts with the types from the brief", () => {
        const sys = LEDGER_ACCOUNT_TEMPLATES.filter(t => t.isSystem);
        assert.equal(sys.length, REQUIRED_SYSTEM_KEYS.length);
        const by = (k: string) => sys.find(t => t.systemKey === k)!;
        assert.equal(by("FEES_RECEIVABLE").type, "ASSET");
        assert.equal(by("ADVANCE_PAYMENTS").type, "LIABILITY");
        assert.equal(by("OPENING_EQUITY").type, "EQUITY");
        assert.equal(by("DISCOUNTS_ALLOWED").type, "EXPENSE");
        assert.equal(by("BANK_DEFAULT").subtype, "BANK");
    });

    it("has 9 editable income and 13 editable expense accounts", () => {
        const ed = LEDGER_ACCOUNT_TEMPLATES.filter(t => !t.isSystem);
        assert.equal(ed.filter(t => t.type === "INCOME").length, 9);
        assert.equal(ed.filter(t => t.type === "EXPENSE").length, 13);
    });

    it("catches bad registries", () => {
        const base = LEDGER_ACCOUNT_TEMPLATES;
        assert.ok(validateLedgerAccountTemplates(base.slice(1)).some(p => p.includes("CASH_DEFAULT")));
        assert.ok(validateLedgerAccountTemplates([...base, { ...base[0] }]).some(p => p.includes("more than once")));
        const badParent: LedgerAccountTemplateDef = { code: "4999", name: "x", type: "INCOME", subtype: "GENERAL", parentCode: "1000", isSystem: false, sortOrder: 1 };
        assert.ok(validateLedgerAccountTemplates([...base, badParent]).some(p => p.includes("different type")));
    });
});

/* ── sync ─────────────────────────────────────────────────────────────── */

function fakeDb(): { db: LedgerTemplateDb; rows: Map<string, LedgerTemplateRow> } {
    const rows = new Map<string, LedgerTemplateRow>();
    const db: LedgerTemplateDb = {
        ledgerAccountTemplate: {
            async findUnique({ where }) {
                if ("code" in where) return rows.get(where.code) ?? null;
                return [...rows.values()].find(r => r.systemKey === where.systemKey) ?? null;
            },
            async create({ data }) { rows.set(data.code, { id: data.code, ...data }); },
            async update({ where, data }) { rows.set(where.code, { ...rows.get(where.code)!, ...data }); },
        },
    };
    return { db, rows };
}

describe("account templates sync", () => {
    it("creates everything on the first run and changes nothing on the second", async () => {
        const { db, rows } = fakeDb();
        const first = await syncLedgerAccountTemplates(db);
        assert.equal(first.created.length, LEDGER_ACCOUNT_TEMPLATES.length);
        assert.equal(rows.size, LEDGER_ACCOUNT_TEMPLATES.length);
        const second = await syncLedgerAccountTemplates(db);
        assert.equal(second.created.length + second.enforced.length + second.conflicts.length, 0);
    });

    it("repairs a system account but leaves an edited editable account alone", async () => {
        const { db, rows } = fakeDb();
        await syncLedgerAccountTemplates(db);
        rows.set("1010", { ...rows.get("1010")!, subtype: "GENERAL", isActive: false });
        rows.set("4000", { ...rows.get("4000")!, name: "School fees" });
        const report = await syncLedgerAccountTemplates(db);
        assert.deepEqual(report.enforced, ["1010"]);
        assert.equal(rows.get("1010")!.subtype, "BANK");
        assert.equal(rows.get("1010")!.isActive, true);
        assert.equal(rows.get("4000")!.name, "School fees");
    });

    it("reports a system key held by another code, and writes nothing for an invalid registry", async () => {
        const { db, rows } = fakeDb();
        rows.set("9999", { id: "x", code: "9999", name: "squatter", type: "ASSET", subtype: "CASH", systemKey: "CASH_DEFAULT", parentCode: null, isSystem: true, isActive: true, sortOrder: 0 });
        const report = await syncLedgerAccountTemplates(db);
        assert.ok(report.conflicts.some(c => c.includes("CASH_DEFAULT")));

        const empty = fakeDb();
        const bad = await syncLedgerAccountTemplates(empty.db, LEDGER_ACCOUNT_TEMPLATES.slice(1));
        assert.ok(bad.conflicts.length > 0);
        assert.equal(empty.rows.size, 0);
    });
});

/* ── periods ──────────────────────────────────────────────────────────── */

describe("monthlyPeriods", () => {
    const d = (s: string) => new Date(`${s}T12:00:00Z`);

    it("January start", () => assert.deepEqual(names(monthlyPeriods(1, d("2026-10-20"))), ["2026-01", "2026-12"]));
    it("September start, after September", () => assert.deepEqual(names(monthlyPeriods(9, d("2026-10-20"))), ["2026-09", "2027-08"]));
    it("September start, before September", () => assert.deepEqual(names(monthlyPeriods(9, d("2026-03-05"))), ["2025-09", "2026-08"]));

    it("uses real month lengths, including a leap February", () => {
        const feb = (y: string) => monthlyPeriods(1, d(`${y}-06-01`))[1];
        assert.equal(feb("2028").endDate, "2028-02-29");
        assert.equal(feb("2026").endDate, "2026-02-28");
    });

    it("has no gaps and no overlaps", () => {
        const ps = monthlyPeriods(9, d("2026-10-20"));
        for (let i = 1; i < ps.length; i++) {
            const prevEnd = new Date(`${ps[i - 1].endDate}T00:00:00Z`).getTime();
            assert.equal(new Date(`${ps[i].startDate}T00:00:00Z`).getTime() - prevEnd, 86_400_000);
        }
    });

    it("rejects a bad start month", () => {
        for (const m of [0, 13, 1.5]) assert.throws(() => monthlyPeriods(m, new Date()));
    });
});

/* ── seed ─────────────────────────────────────────────────────────────── */

describe("seedFinanceBooks", () => {
    const run = async (templates = LEDGER_ACCOUNT_TEMPLATES) => {
        const calls: { text: string; params: unknown[] }[] = [];
        const result = await seedFinanceBooks({ async query(text, params = []) { calls.push({ text, params }); } }, templates, { today: new Date("2026-10-20T12:00:00Z") });
        return { calls, result };
    };

    it("inserts every account then 12 open periods", async () => {
        const { calls, result } = await run();
        assert.deepEqual(result, { accounts: LEDGER_ACCOUNT_TEMPLATES.length, periods: 12 });
        assert.equal(calls.filter(c => c.text.includes('"LedgerAccount"')).length, LEDGER_ACCOUNT_TEMPLATES.length);
        assert.equal(calls.filter(c => c.text.includes('"FinancePeriod"')).length, 12);
    });

    it("flags money accounts and locks system accounts", async () => {
        const { calls } = await run();
        const row = (code: string) => calls.find(c => c.params[1] === code)!.params;
        assert.equal(row("1010")[7], true);    // bank: money account
        assert.equal(row("1100")[7], false);   // receivable: not
        assert.equal(row("1010")[8], true);    // system: locked
        assert.equal(row("4000")[8], false);   // editable: not locked
    });

    it("inserts a parent before its child", async () => {
        const templates = [
            { code: "4001", name: "Child", type: "INCOME", subtype: "GENERAL", systemKey: null, parentCode: "4000", isSystem: false, sortOrder: 0 },
            ...LEDGER_ACCOUNT_TEMPLATES.map(t => ({ ...t, systemKey: t.systemKey ?? null, parentCode: t.parentCode ?? null })),
        ];
        const { calls } = await run(templates as any);
        const order = calls.filter(c => c.text.includes('"LedgerAccount"')).map(c => c.params[1]);
        assert.ok(order.indexOf("4000") < order.indexOf("4001"));
    });

    it("refuses to run when a system account is missing, telling the operator what to do", async () => {
        await assert.rejects(() => run(LEDGER_ACCOUNT_TEMPLATES.filter(t => t.systemKey !== "BANK_DEFAULT")), /BANK_DEFAULT[\s\S]*sync:registries/);
    });

    it("fails clearly on a missing parent", async () => {
        const orphan = { ...LEDGER_ACCOUNT_TEMPLATES[12], code: "4998", parentCode: "0000" };
        await assert.rejects(() => run([...LEDGER_ACCOUNT_TEMPLATES, orphan] as any), /0000/);
    });
});
