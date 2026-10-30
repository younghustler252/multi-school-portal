/*
|--------------------------------------------------------------------------
| FINANCE: chart of accounts management (add, edit, nest, deactivate, delete) and its request validation.
| Logic only, against an in-memory repository.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CreateAccountUseCase, UpdateAccountUseCase, SetAccountActiveUseCase, DeleteAccountUseCase } from "../../src/modules/ledger/usecases/account-commands.usecases";
import { ListAccountsUseCase, GetAccountUseCase } from "../../src/modules/ledger/usecases/account-queries.usecases";
import { LedgerAccountMapper } from "../../src/modules/ledger/mappers/ledger-account.mapper";
import { nextAccountCode } from "../../src/modules/ledger/domain/ledger.policy";
import { CreateAccountDto, UpdateAccountDto, ListAccountsQuery } from "../../src/modules/ledger/dtos/ledger.dto";
import type { LedgerAccountEntity } from "../../src/modules/ledger/domain/ledger.entity";

const account = (over: Partial<LedgerAccountEntity> & { id: string; code: string; name: string }): LedgerAccountEntity => ({
    type: "INCOME", subtype: "GENERAL", systemKey: null, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0,
    description: null, bankName: null, accountName: null, accountNumberLast4: null, createdAt: new Date("2026-10-01T00:00:00Z"), deletedAt: null, ...over,
});

function setup() {
    const rows: LedgerAccountEntity[] = [
        account({ id: "tuition", code: "4000", name: "Tuition fees" }),
        account({ id: "uniforms", code: "4040", name: "Uniforms" }),
        account({ id: "other-inc", code: "4900", name: "Other income" }),
        account({ id: "rent", code: "5200", name: "Rent", type: "EXPENSE" }),
        account({ id: "bank", code: "1010", name: "Main bank account", type: "ASSET", subtype: "BANK", isMoneyAccount: true, isLocked: true, systemKey: "BANK_DEFAULT" }),
        account({ id: "cash", code: "1000", name: "Cash on hand", type: "ASSET", subtype: "CASH", isMoneyAccount: true, isLocked: true, systemKey: "CASH_DEFAULT" }),
        account({ id: "petty", code: "1020", name: "Petty cash", type: "ASSET", subtype: "PETTY_CASH", isMoneyAccount: true }),
    ];
    const deletedCodes = new Set<string>(["4050"]);                // a deleted account still owns its code
    const lines = new Map<string, number>();
    const totals = new Map<string, { debit: bigint; credit: bigint }>();
    const audit: any[] = [];
    let seq = 0;

    const ledgerAccountRepository: any = {
        async findById(id: string) { return rows.find(r => r.id === id && !r.deletedAt) ?? null; },
        async listFiltered(f: any) {
            return rows.filter(r => !r.deletedAt && (!f.type || r.type === f.type) && (f.status === "all" || (f.status === "inactive" ? !r.isActive : r.isActive))
                && (!f.q || r.name.toLowerCase().includes(f.q.toLowerCase()) || r.code.startsWith(f.q))).sort((a, b) => a.code.localeCompare(b.code));
        },
        async codeExists(code: string) { return rows.some(r => r.code === code) || deletedCodes.has(code); },
        async codesInRange(prefix: string) { return [...rows.map(r => r.code), ...deletedCodes].filter(c => c.startsWith(prefix)); },
        async countLines(id: string) { return lines.get(id) ?? 0; },
        async countChildren(id: string, activeOnly: boolean) { return rows.filter(r => r.parentId === id && !r.deletedAt && (!activeOnly || r.isActive)).length; },
        async create(data: any) { const a = account({ id: `new-${++seq}`, ...data }); rows.push(a); return a; },
        async update(id: string, data: any) { const a = rows.find(r => r.id === id)!; Object.assign(a, data); return a; },
        async delete(id: string) { const a = rows.find(r => r.id === id)!; a.deletedAt = new Date(); return a; },
    };
    const ledgerReportRepository: any = {
        async totalsBefore(id: string) { return totals.get(id) ?? { debit: 0n, credit: 0n }; },
        async balancesAsOf() { return [...totals].map(([accountId, t]) => ({ accountId, balanceKobo: t.debit - t.credit })); },
    };
    const d: any = { ledgerAccountRepository, ledgerReportRepository, ledgerAccountMapper: new LedgerAccountMapper(), auditService: { async log(p: any) { audit.push(p); } } };
    return { d, rows, lines, totals, audit };
}

const create = (t: ReturnType<typeof setup>, dto: any) => new CreateAccountUseCase(t.d).execute("school-1", "user-1", { kind: "GENERAL", ...dto });
const code = (c: string) => (e: any) => e.code === c;

describe("next account code", () => {
    it("is ten above the highest code in the range, below the x900 account", () => {
        assert.equal(nextAccountCode("INCOME", ["4000", "4040", "4900"]), "4050");
        assert.equal(nextAccountCode("EXPENSE", ["5000", "5210", "5900"]), "5220");
        assert.equal(nextAccountCode("ASSET", []), "1000");
        assert.equal(nextAccountCode("INCOME", ["4890"]), null);          // range full: the person must choose
        assert.equal(nextAccountCode("INCOME", ["1000", "5000"]), "4000"); // other ranges are ignored
    });
});

describe("add account", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });

    it("makes the next code, counting codes of deleted accounts as used, and audits", async () => {
        const r = await create(t, { name: "Excursion fees", type: "INCOME" });
        assert.equal(r.code, "4060");             // highest is 4050 (a deleted account's), so 4060
        assert.equal(r.isLocked, false);
        assert.equal(r.subtype, "GENERAL");
        assert.equal(t.audit[0].action, "finance.account.created");
        assert.equal(t.audit[0].schoolId, "school-1");
    });

    it("uses a chosen code if it matches the type and is free", async () => {
        assert.equal((await create(t, { name: "Hostel", type: "INCOME", code: "4100" })).code, "4100");
        await assert.rejects(() => create(t, { name: "x", type: "INCOME", code: "5100" }), code("INVALID_ACCOUNT_CODE"));
        await assert.rejects(() => create(t, { name: "x", type: "INCOME", code: "4000" }), code("ACCOUNT_CODE_TAKEN"));
        await assert.rejects(() => create(t, { name: "x", type: "INCOME", code: "4050" }), code("ACCOUNT_CODE_TAKEN"));      // deleted account's code
    });

    it("makes money accounts from cash, bank and petty cash kinds", async () => {
        const r = await create(t, { name: "GTB school account", type: "ASSET", kind: "BANK", bankName: "GTBank", accountNumberLast4: "1234" });
        assert.equal(r.isMoneyAccount, true);
        assert.equal(r.subtype, "BANK");
        assert.equal(r.accountNumberLast4, "1234");
    });

    it("nests under an active parent of the same type only", async () => {
        const ok = await create(t, { name: "Hostel fees", type: "INCOME", parentId: "tuition" });
        assert.equal(ok.parentId, "tuition");
        await assert.rejects(() => create(t, { name: "x", type: "INCOME", parentId: "rent" }), code("INVALID_ACCOUNT"));
        await assert.rejects(() => create(t, { name: "x", type: "INCOME", parentId: "ghost" }), code("INVALID_ACCOUNT"));
    });

    it("a clash on the database's unique code becomes ACCOUNT_CODE_TAKEN", async () => {
        const racing = { ...t.d.ledgerAccountRepository, create: async () => { throw Object.assign(new Error("unique"), { code: "P2002" }); } };
        await assert.rejects(() => new CreateAccountUseCase({ ...t.d, ledgerAccountRepository: racing }).execute("s", "u", { name: "x", type: "INCOME", kind: "GENERAL" } as any), code("ACCOUNT_CODE_TAKEN"));
    });
});

describe("edit account", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });
    const update = (id: string, dto: any) => new UpdateAccountUseCase(t.d).execute(id, "school-1", "user-1", dto);

    it("renames and records only what changed", async () => {
        const r = await update("uniforms", { name: "School uniforms", description: "Shirts and shorts" });
        assert.equal(r.name, "School uniforms");
        assert.deepEqual(t.audit[0].oldValue, { name: "Uniforms", description: null });
        assert.deepEqual(Object.keys(t.audit[0].newValue).sort(), ["description", "name"]);
    });

    it("does nothing (and writes no audit entry) when nothing changed", async () => {
        await update("uniforms", { name: "Uniforms" });
        assert.equal(t.audit.length, 0);
    });

    it("lets a system account be renamed but not moved", async () => {
        assert.equal((await update("bank", { name: "GTBank main account" })).name, "GTBank main account");
        await assert.rejects(() => update("cash", { parentId: "tuition" }), code("ACCOUNT_LOCKED"));
    });

    it("keeps bank details to bank accounts", async () => {
        await update("bank", { bankName: "GTBank", accountNumberLast4: "9876" });
        await assert.rejects(() => update("cash", { bankName: "GTBank" }), code("INVALID_ACCOUNT"));
    });

    it("refuses nesting under itself, its own sub-account, another type, or an inactive account", async () => {
        await update("uniforms", { parentId: "tuition" });
        await assert.rejects(() => update("tuition", { parentId: "tuition" }), code("INVALID_ACCOUNT"));
        await assert.rejects(() => update("tuition", { parentId: "uniforms" }), code("INVALID_ACCOUNT"));       // a loop
        await assert.rejects(() => update("tuition", { parentId: "rent" }), code("INVALID_ACCOUNT"));
        t.rows.find(r => r.id === "other-inc")!.isActive = false;
        await assert.rejects(() => update("tuition", { parentId: "other-inc" }), code("INVALID_ACCOUNT"));
    });

    it("can move an account back to the top level", async () => {
        await update("uniforms", { parentId: "tuition" });
        assert.equal((await update("uniforms", { parentId: null })).parentId, null);
    });

    it("says so when the account does not exist", async () => {
        await assert.rejects(() => update("ghost", { name: "xx" }), code("ACCOUNT_NOT_FOUND"));
    });
});

describe("deactivate and reactivate", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });
    const setActive = (id: string, active: boolean) => new SetAccountActiveUseCase(t.d).execute(id, "school-1", "user-1", active);

    it("deactivates an ordinary account and brings it back, with audit entries", async () => {
        assert.equal((await setActive("uniforms", false)).isActive, false);
        assert.equal((await setActive("uniforms", true)).isActive, true);
        assert.deepEqual(t.audit.map(a => a.action), ["finance.account.deactivated", "finance.account.reactivated"]);
    });

    it("refuses system accounts, repeats, active sub-accounts, and money still held", async () => {
        await assert.rejects(() => setActive("bank", false), code("ACCOUNT_LOCKED"));
        await assert.rejects(() => setActive("uniforms", true), code("ACCOUNT_ALREADY_ACTIVE"));
        await setActive("uniforms", false);
        await assert.rejects(() => setActive("uniforms", false), code("ACCOUNT_ALREADY_INACTIVE"));

        t.rows.find(r => r.id === "uniforms")!.parentId = "tuition";
        t.rows.find(r => r.id === "uniforms")!.isActive = true;
        await assert.rejects(() => setActive("tuition", false), code("ACCOUNT_HAS_CHILDREN"));

        t.totals.set("petty", { debit: 5000n, credit: 1000n });
        await assert.rejects(() => setActive("petty", false), (e: any) => e.code === "ACCOUNT_HAS_BALANCE" && e.details.balanceKobo === "4000");
        t.totals.set("petty", { debit: 5000n, credit: 5000n });
        assert.equal((await setActive("petty", false)).isActive, false);
    });

    it("will not reactivate under an inactive parent", async () => {
        t.rows.find(r => r.id === "uniforms")!.parentId = "tuition";
        await setActive("uniforms", false);
        t.rows.find(r => r.id === "tuition")!.isActive = false;
        await assert.rejects(() => setActive("uniforms", true), code("INVALID_ACCOUNT"));
    });
});

describe("delete account", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });
    const remove = (id: string) => new DeleteAccountUseCase(t.d).execute(id, "school-1", "user-1");

    it("deletes (softly) an account that was never used", async () => {
        await remove("uniforms");
        assert.ok(t.rows.find(r => r.id === "uniforms")!.deletedAt);
        assert.equal(t.audit[0].action, "finance.account.deleted");
    });

    it("refuses system accounts, accounts with postings, and accounts with sub-accounts", async () => {
        await assert.rejects(() => remove("bank"), code("ACCOUNT_LOCKED"));
        t.lines.set("uniforms", 3);
        await assert.rejects(() => remove("uniforms"), (e: any) => e.code === "ACCOUNT_HAS_POSTINGS" && e.details.lines === 3);
        t.rows.find(r => r.id === "other-inc")!.parentId = "tuition";
        await assert.rejects(() => remove("tuition"), code("ACCOUNT_HAS_CHILDREN"));
        assert.equal(t.audit.length, 0);
    });
});

describe("account reads", () => {
    it("lists by code, filtered, with balances only when asked", async () => {
        const t = setup();
        t.totals.set("bank", { debit: 90_000n, credit: 20_000n });
        const uc = new ListAccountsUseCase(t.d);
        const plain = await uc.execute({ status: "active", withBalances: false, type: "ASSET" } as any);
        assert.deepEqual(plain.map(a => a.code), ["1000", "1010", "1020"]);
        assert.ok(!("balanceKobo" in plain[0]));
        const withBal = await uc.execute({ status: "active", withBalances: true, type: "ASSET" } as any);
        assert.deepEqual(withBal.map(a => a.balanceKobo), [0, 70_000, 0]);
        assert.equal((await uc.execute({ status: "active", withBalances: false, q: "rent" } as any)).length, 1);
    });

    it("gets one account with its balance on its natural side", async () => {
        const t = setup();
        t.totals.set("tuition", { debit: 0n, credit: 500_000n });
        assert.equal((await new GetAccountUseCase(t.d).execute("tuition")).balanceKobo, 500_000);
        await assert.rejects(() => new GetAccountUseCase(t.d).execute("ghost"), code("ACCOUNT_NOT_FOUND"));
    });
});

describe("account request validation", () => {
    const bad = (schema: { safeParse(v: unknown): { success: boolean } }, v: unknown) => assert.equal(schema.safeParse(v).success, false);

    it("accepts a simple account and a bank account", () => {
        assert.equal(CreateAccountDto.parse({ name: "Hostel fees", type: "INCOME" }).kind, "GENERAL");
        assert.ok(CreateAccountDto.safeParse({ name: "GTB account", type: "ASSET", kind: "BANK", bankName: "GTBank", accountNumberLast4: "1234" }).success);
    });

    it("refuses money accounts that are not assets, bank details on other kinds, and bad codes", () => {
        bad(CreateAccountDto, { name: "Cash box", type: "INCOME", kind: "CASH" });
        bad(CreateAccountDto, { name: "Petty", type: "ASSET", kind: "PETTY_CASH", bankName: "GTBank" });
        bad(CreateAccountDto, { name: "x", type: "INCOME" });                          // name too short
        bad(CreateAccountDto, { name: "Hostel", type: "INCOME", code: "41" });
        bad(CreateAccountDto, { name: "Hostel", type: "INCOME", kind: "RECEIVABLE" }); // system-only kind
        bad(CreateAccountDto, { name: "Hostel", type: "INCOME", systemKey: "CASH_DEFAULT" });
    });

    it("update cannot touch code or type, and must change something", () => {
        bad(UpdateAccountDto, {});
        bad(UpdateAccountDto, { code: "4999" });
        bad(UpdateAccountDto, { type: "EXPENSE" });
        bad(UpdateAccountDto, { accountNumberLast4: "12" });
        assert.ok(UpdateAccountDto.safeParse({ parentId: null, description: null }).success);
    });

    it("list query defaults to active accounts", () => {
        const q = ListAccountsQuery.parse({});
        assert.equal(q.status, "active");
        assert.equal(q.withBalances, false);
        bad(ListAccountsQuery, { status: "deleted" });
    });
});
