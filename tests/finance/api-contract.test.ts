/*
|--------------------------------------------------------------------------
| FINANCE: the API's edges (no database, no server): permission keys and grants, request validation,
| money in and out of JSON, and the controller's use of the session.
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { OpeningBalanceDto, TransferDto, ManualJournalDto, ListJournalsQuery } from "../../src/modules/ledger/dtos/ledger.dto";
import { koboOut } from "../../src/modules/ledger/mappers/kobo";
import { JournalMapper } from "../../src/modules/ledger/mappers/journal.mapper";
import { LedgerController } from "../../src/modules/ledger/controllers/ledger.controller";

describe("finance permissions", () => {
    const finance = PERMISSION_REGISTRY.filter(p => p.module === "finance");

    it("registry is still valid with the books keys", () => assert.deepEqual(validatePermissionRegistry(), []));

    it("has the 7 books keys, posting and reversing are sensitive", () => {
        assert.equal(finance.length, 7);
        assert.deepEqual(finance.filter(p => p.isSensitive).map(p => p.key).sort(), ["finance.journals.post", "finance.journals.reverse"]);
    });

    it("every key a role template grants exists in the registry", () => {
        const known = new Set(PERMISSION_REGISTRY.map(p => p.key));
        for (const r of ROLE_TEMPLATES) for (const p of r.permissions) assert.ok(known.has(p.key), `${r.key} grants unknown key ${p.key}`);
    });

    it("bursar and principal can view the books but never post or reverse", () => {
        for (const key of ["bursar", "principal"]) {
            const granted = ROLE_TEMPLATES.find(r => r.key === key)!.permissions.map(p => p.key);
            for (const k of ["finance.accounts.view", "finance.journals.view", "finance.periods.view", "finance.reports.view"]) assert.ok(granted.includes(k), `${key} lacks ${k}`);
            assert.ok(!granted.includes("finance.journals.post") && !granted.includes("finance.journals.reverse"));
        }
    });

    it("students and guardians get no finance books access", () => {
        for (const key of ["student", "guardian"]) {
            assert.ok(!ROLE_TEMPLATES.find(r => r.key === key)!.permissions.some(p => p.key.startsWith("finance.")));
        }
    });
});

describe("request validation", () => {
    const manual = { entryDate: "2026-10-10", description: "Accrue rent", reason: "Invoice pending", lines: [{ accountId: "a", debitKobo: 500 }, { accountId: "b", creditKobo: "500" }] };

    it("turns kobo into BigInt, from numbers or digit strings", () => {
        const r = ManualJournalDto.parse(manual);
        assert.deepEqual(r.lines.map(l => [l.debitKobo, l.creditKobo]), [[500n, undefined], [undefined, 500n]]);
        assert.equal(OpeningBalanceDto.parse({ accountId: "a", amountKobo: "-250000", asOfDate: "2026-09-30" }).amountKobo, -250000n);
        assert.equal(TransferDto.parse({ fromAccountId: "a", toAccountId: "b", amountKobo: "99999999999999999", entryDate: "2026-10-10" }).amountKobo, 99999999999999999n);
    });

    it("refuses decimals, negatives where they make no sense, and junk", () => {
        const bad = (schema: { safeParse(v: unknown): { success: boolean } }, v: unknown) => assert.equal(schema.safeParse(v).success, false);
        bad(TransferDto, { fromAccountId: "a", toAccountId: "b", amountKobo: 10.5, entryDate: "2026-10-10" });
        bad(TransferDto, { fromAccountId: "a", toAccountId: "b", amountKobo: -10, entryDate: "2026-10-10" });
        bad(TransferDto, { fromAccountId: "a", toAccountId: "b", amountKobo: "12abc", entryDate: "2026-10-10" });
        bad(TransferDto, { fromAccountId: "a", toAccountId: "b", amountKobo: 10, entryDate: "10/10/2026" });
        bad(TransferDto, { fromAccountId: "a", toAccountId: "b", amountKobo: 10, entryDate: "2026-10-10", sneaky: 1 });
        bad(ManualJournalDto, { ...manual, lines: [manual.lines[0]] });
        bad(ManualJournalDto, { ...manual, reason: " " });
        bad(ManualJournalDto, { ...manual, lines: [{ accountId: "a", debitKobo: 5, creditKobo: 5 }, manual.lines[1]] });
        bad(ManualJournalDto, { ...manual, lines: [{ accountId: "a" }, manual.lines[1]] });
    });

    it("list query has sane defaults and a limit cap", () => {
        const q = ListJournalsQuery.parse({});
        assert.equal(q.page, 1); assert.equal(q.limit, 25);
        assert.equal(ListJournalsQuery.safeParse({ limit: "1000" }).success, false);
        assert.equal(ListJournalsQuery.safeParse({ status: "DELETED" }).success, false);
    });
});

describe("money in responses", () => {
    it("is a plain number when safe and a string when not", () => {
        assert.equal(koboOut(12_345n), 12345);
        assert.equal(koboOut(-50n), -50);
        assert.equal(koboOut(9_007_199_254_740_993n), "9007199254740993");
    });

    it("journal detail carries account names and has no BigInt left to break JSON", () => {
        const mapper = new JournalMapper();
        const out = mapper.toDetail(mapper.toDomain({
            id: "j", number: "JE-2026-000001", entryDate: new Date("2026-10-05T00:00:00Z"), description: "d", sourceType: "MANUAL", sourceId: "s", purpose: "MANUAL",
            status: "POSTED", totalKobo: 700n, reversalOfId: null, reversalReason: null, branchId: null, termId: null, sessionId: null, createdById: "u", isSystemActor: false, postedAt: new Date(),
            period: { name: "2026-10", status: "OPEN" },
            lines: [{ lineNumber: 1, ledgerAccountId: "a", ledgerAccount: { code: "5100", name: "Utilities" }, debitKobo: 700n, creditKobo: 0n, partyType: null, partyId: null, memo: null }],
        } as any));
        assert.doesNotThrow(() => JSON.stringify(out));
        assert.equal(out.entryDate, "2026-10-05");
        assert.equal(out.lines[0].accountName, "Utilities");
    });
});

describe("controller", () => {
    const run = async (fn: (c: LedgerController, res: any, next: (e?: unknown) => void) => Promise<void>) => {
        const seen: any = {};
        const res: any = { status(c: number) { seen.status = c; return this; }, json(b: unknown) { seen.body = b; return this; } };
        const recordTransferUseCase = { execute: async (schoolId: string, userId: string, dto: unknown) => { seen.args = { schoolId, userId, dto }; return { journal: { id: "j" }, duplicate: false }; } };
        const c = new LedgerController({ recordTransferUseCase } as any);
        await fn(c, res, (e) => { seen.error = e; });
        return seen;
    };

    it("takes the school from the host and the actor from the session, never from the body", async () => {
        const seen = await run((c, res, next) => c.transfer({ schoolId: "school-1", auth: { userId: "real-user" }, body: { fromAccountId: "a", toAccountId: "b", amountKobo: 5n, entryDate: "2026-10-10" } } as any, res, next));
        assert.equal(seen.args.schoolId, "school-1");
        assert.equal(seen.args.userId, "real-user");
        assert.equal(seen.status, 201);
    });

    it("refuses a request with no session", async () => {
        const seen = await run((c, res, next) => c.transfer({ schoolId: "school-1", body: {} } as any, res, next));
        assert.equal(seen.error.code, "TOKEN_MISSING");
    });
});
