/*
|--------------------------------------------------------------------------
| FINANCE BOOKS: what the DATABASE itself refuses (migration 20261019061500_finance_books).
| These rules hold even if application code has a bug, so they are tested with plain SQL, not through
| the posting service. Real Postgres, TEST database only (see docs/TESTING_GUIDE.md).
|
| Each test uses its own journal ids, because posted journals can never be deleted (that is the point).
| The whole throwaway school is dropped when the file finishes.
|--------------------------------------------------------------------------
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { dbTestsEnabled, skipReason, createTestSchool, TestSchool } from "../helpers/test-database";

describe("finance books schema (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    let client: typeof import("../../src/infrastructure/database/prisma/prisma.client");

    const exec = (sql: string) => client.getTenantClient().$executeRawUnsafe(sql);
    const rows = (sql: string) => client.getTenantClient().$queryRawUnsafe<any[]>(sql);
    const count = async (sql: string) => Number((await rows(sql))[0].n);

    type Line = [account: string, debit: number, credit: number];

    // Saves a journal and its lines together, the way the posting service will (one transaction)
    const post = (id: string, total: number, lines: Line[]) =>
        school.run(() => client.withTenantTransaction(async () => {
            await exec(
                `INSERT INTO "JournalEntry"(id, number, "entryDate", "periodId", description, "sourceType", purpose, "idempotencyKey", "totalKobo")
                 VALUES ('${id}', 'N-${id}', '2026-10-05', 'p1', 'test ${id}', 'MANUAL', 'TEST', 'MANUAL:${id}', ${total})`);
            for (const [i, [account, debit, credit]] of lines.entries()) {
                await exec(
                    `INSERT INTO "JournalLine"(id, "journalId", "lineNumber", "ledgerAccountId", "debitKobo", "creditKobo")
                     VALUES ('${id}-l${i + 1}', '${id}', ${i + 1}, '${account}', ${debit}, ${credit})`);
            }
        }));

    const entryCount = (id: string) => school.run(() => count(`SELECT count(*) AS n FROM "JournalEntry" WHERE id = '${id}'`));

    before(async () => {
        school = await createTestSchool();
        client = await import("../../src/infrastructure/database/prisma/prisma.client");
        await school.run(async () => {
            await exec(`INSERT INTO "FinancePeriod"(id, name, "startDate", "endDate", "updatedAt") VALUES ('p1', '2026-10', '2026-10-01', '2026-10-31', now())`);
            await exec(`INSERT INTO "LedgerAccount"(id, code, name, type, "updatedAt") VALUES
                ('cash', '1000', 'Cash on hand', 'ASSET', now()), ('income', '4000', 'Tuition income', 'INCOME', now())`);
        });
    });

    after(async () => { await school?.drop(); });

    it("saves a balanced journal, including an amount above the 32-bit limit (about N21.4 million)", async () => {
        await post("big", 999_999_999_999, [["cash", 999_999_999_999, 0], ["income", 0, 999_999_999_999]]);
        const [row] = await school.run(() => rows(`SELECT "totalKobo" FROM "JournalEntry" WHERE id = 'big'`));
        assert.equal(String(row.totalKobo), "999999999999");
    });

    it("refuses a line that has both a debit and a credit, or neither, or a negative amount", async () => {
        await post("good-for-lines", 100, [["cash", 100, 0], ["income", 0, 100]]);
        for (const [debit, credit] of [[5, 5], [0, 0], [-5, 0]]) {
            await assert.rejects(() => school.run(() => exec(
                `INSERT INTO "JournalLine"(id, "journalId", "lineNumber", "ledgerAccountId", "debitKobo", "creditKobo")
                 VALUES ('bad-${debit}-${credit}', 'good-for-lines', 9, 'cash', ${debit}, ${credit})`)));
        }
        assert.equal(await school.run(() => count(`SELECT count(*) AS n FROM "JournalLine" WHERE "journalId" = 'good-for-lines'`)), 2);
    });

    it("refuses an unbalanced journal when it is saved, and saves nothing", async () => {
        await assert.rejects(() => post("unbalanced", 5000, [["cash", 5000, 0], ["income", 0, 4000]]));
        assert.equal(await entryCount("unbalanced"), 0);
    });

    it("refuses a journal with only one line, and a journal whose total does not match its debits", async () => {
        await assert.rejects(() => post("one-line", 5000, [["cash", 5000, 0]]));
        await assert.rejects(() => post("wrong-total", 9999, [["cash", 5000, 0], ["income", 0, 5000]]));
        assert.equal(await entryCount("one-line"), 0);
        assert.equal(await entryCount("wrong-total"), 0);
    });

    it("never lets a posted journal be edited or deleted", async () => {
        await post("fixed", 5000, [["cash", 5000, 0], ["income", 0, 5000]]);
        await assert.rejects(() => school.run(() => exec(`UPDATE "JournalEntry" SET description = 'changed' WHERE id = 'fixed'`)));
        await assert.rejects(() => school.run(() => exec(`UPDATE "JournalEntry" SET "totalKobo" = 1 WHERE id = 'fixed'`)));
        await assert.rejects(() => school.run(() => exec(`DELETE FROM "JournalEntry" WHERE id = 'fixed'`)));
        const [row] = await school.run(() => rows(`SELECT description, "totalKobo" FROM "JournalEntry" WHERE id = 'fixed'`));
        assert.equal(row.description, "test fixed");
        assert.equal(String(row.totalKobo), "5000");
    });

    it("never lets a journal line be changed or deleted", async () => {
        await post("lines-fixed", 5000, [["cash", 5000, 0], ["income", 0, 5000]]);
        await assert.rejects(() => school.run(() => exec(`UPDATE "JournalLine" SET "debitKobo" = 1 WHERE id = 'lines-fixed-l1'`)));
        await assert.rejects(() => school.run(() => exec(`DELETE FROM "JournalLine" WHERE id = 'lines-fixed-l1'`)));
        const [row] = await school.run(() => rows(`SELECT "debitKobo" FROM "JournalLine" WHERE id = 'lines-fixed-l1'`));
        assert.equal(String(row.debitKobo), "5000");
    });

    it("refuses the same event posting twice (same idempotency key)", async () => {
        await post("once", 5000, [["cash", 5000, 0], ["income", 0, 5000]]);
        await assert.rejects(() => school.run(() => client.withTenantTransaction(async () => {
            await exec(`INSERT INTO "JournalEntry"(id, number, "entryDate", "periodId", description, "sourceType", purpose, "idempotencyKey", "totalKobo")
                        VALUES ('once-again', 'N-once-again', '2026-10-05', 'p1', 'dup', 'MANUAL', 'TEST', 'MANUAL:once', 5000)`);
        })));
        assert.equal(await entryCount("once-again"), 0);
    });

    it("reverses a journal: swapped lines, linked, original marked REVERSED; and only once", async () => {
        await post("orig", 5000, [["cash", 5000, 0], ["income", 0, 5000]]);

        await school.run(() => client.withTenantTransaction(async () => {
            await exec(`INSERT INTO "JournalEntry"(id, number, "entryDate", "periodId", description, "sourceType", purpose, "idempotencyKey", "totalKobo", "reversalOfId", "reversalReason")
                        VALUES ('orig-rev', 'N-orig-rev', '2026-10-06', 'p1', 'reversal', 'REVERSAL', 'REVERSAL', 'REVERSAL:orig', 5000, 'orig', 'entered by mistake')`);
            await exec(`INSERT INTO "JournalLine"(id, "journalId", "lineNumber", "ledgerAccountId", "debitKobo", "creditKobo")
                        VALUES ('orig-rev-l1', 'orig-rev', 1, 'cash', 0, 5000), ('orig-rev-l2', 'orig-rev', 2, 'income', 5000, 0)`);
            await exec(`UPDATE "JournalEntry" SET status = 'REVERSED' WHERE id = 'orig'`);
        }));

        const [original] = await school.run(() => rows(`SELECT status FROM "JournalEntry" WHERE id = 'orig'`));
        assert.equal(original.status, "REVERSED");

        // a second reversal of the same journal, and un-reversing, are both refused
        await assert.rejects(() => school.run(() => exec(
            `INSERT INTO "JournalEntry"(id, number, "entryDate", "periodId", description, "sourceType", purpose, "idempotencyKey", "totalKobo", "reversalOfId")
             VALUES ('orig-rev-2', 'N-orig-rev-2', '2026-10-06', 'p1', 'again', 'REVERSAL', 'REVERSAL', 'REVERSAL:orig:2', 5000, 'orig')`)));
        await assert.rejects(() => school.run(() => exec(`UPDATE "JournalEntry" SET status = 'POSTED' WHERE id = 'orig'`)));
    });

    it("refuses a REVERSAL that points at nothing, and a normal journal that points at another", async () => {
        await post("target", 5000, [["cash", 5000, 0], ["income", 0, 5000]]);

        const entry = (id: string, sourceType: string, reversalOfId: string | null) =>
            `INSERT INTO "JournalEntry"(id, number, "entryDate", "periodId", description, "sourceType", purpose, "idempotencyKey", "totalKobo", "reversalOfId")
             VALUES ('${id}', 'N-${id}', '2026-10-06', 'p1', 'x', '${sourceType}', 'TEST', 'K:${id}', 5000, ${reversalOfId ? `'${reversalOfId}'` : "NULL"})`;

        await assert.rejects(() => school.run(() => exec(entry("lonely-reversal", "REVERSAL", null))));
        await assert.rejects(() => school.run(() => exec(entry("pointing-manual", "MANUAL", "target"))));
        assert.equal(await entryCount("lonely-reversal"), 0);
        assert.equal(await entryCount("pointing-manual"), 0);
    });

    it("refuses a period that ends before it starts, and two periods with the same start", async () => {
        await assert.rejects(() => school.run(() => exec(
            `INSERT INTO "FinancePeriod"(id, name, "startDate", "endDate", "updatedAt") VALUES ('bad-dates', 'bad', '2026-11-30', '2026-11-01', now())`)));
        await assert.rejects(() => school.run(() => exec(
            `INSERT INTO "FinancePeriod"(id, name, "startDate", "endDate", "updatedAt") VALUES ('same-start', 'same', '2026-10-01', '2026-10-31', now())`)));
    });
});
