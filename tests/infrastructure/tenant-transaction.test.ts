/*
|--------------------------------------------------------------------------
| withTenantTransaction, tested against a real Postgres (the TEST database).
| Uses the NumberSequence table because it is simple and owned by the Foundation, so it will not change
| when finance changes its own tables.
|--------------------------------------------------------------------------
*/
import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { dbTestsEnabled, skipReason, createTestSchool, TestSchool } from "../helpers/test-database";

describe("withTenantTransaction (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    let client: typeof import("../../src/infrastructure/database/prisma/prisma.client");
    let BaseTenantRepository: typeof import("../../src/infrastructure/repository/base.repository").BaseTenantRepository;

    const add   = (key: string) => client.getTenantClient().numberSequence.create({ data: { key } });
    const count = () => school.run(() => client.getTenantClient().numberSequence.count());

    before(async () => {
        school = await createTestSchool();
        client = await import("../../src/infrastructure/database/prisma/prisma.client");
        ({ BaseTenantRepository } = await import("../../src/infrastructure/repository/base.repository"));
    });

    beforeEach(() => school.run(() => client.getTenantClient().numberSequence.deleteMany()));

    after(async () => { await school?.drop(); });

    it("a plain write outside the helper is saved at once", async () => {
        await school.run(() => add("plain"));
        assert.equal(await count(), 1);
    });

    it("saves everything when the work finishes", async () => {
        await school.run(() => client.withTenantTransaction(async () => {
            await add("one");
            await add("two");
        }));
        assert.equal(await count(), 2);
    });

    it("saves nothing when the work throws, and the error comes out unchanged", async () => {
        const boom = new Error("journal does not balance");
        await assert.rejects(
            () => school.run(() => client.withTenantTransaction(async () => {
                await add("one");
                await add("two");
                throw boom;
            })),
            (err) => err === boom,
        );
        assert.equal(await count(), 0);
    });

    it("a repository that calls getTenantClient() joins the transaction with no change", async () => {
        class SequenceRepository extends BaseTenantRepository<any> {
            protected readonly modelName = "numberSequence";
            constructor() { super({ toDomain: (raw: any) => raw }); }
        }
        const repository = new SequenceRepository();

        await assert.rejects(
            () => school.run(() => client.withTenantTransaction(async () => {
                await repository.create({ key: "from-repository" });
                throw new Error("later step failed");
            })),
            /later step failed/,
        );
        assert.equal(await count(), 0, "the repository's write must be rolled back too");

        await school.run(() => client.withTenantTransaction(async () => {
            await repository.create({ key: "from-repository" });
        }));
        assert.equal(await count(), 1);
    });

    it("a helper call inside another one joins it", async () => {
        await school.run(() => client.withTenantTransaction(async () => {
            await add("outer");
            await client.withTenantTransaction(async () => { await add("inner"); });
        }));
        assert.equal(await count(), 2);
    });

    it("a failure in the inner call rolls back the outer work too", async () => {
        await assert.rejects(
            () => school.run(() => client.withTenantTransaction(async () => {
                await add("outer");
                await client.withTenantTransaction(async () => { throw new Error("inner failed"); });
            })),
            /inner failed/,
        );
        assert.equal(await count(), 0);
    });

    it("code that opens its own $transaction inside the helper runs in the same transaction", async () => {
        await assert.rejects(
            () => school.run(() => client.withTenantTransaction(async () => {
                await client.getTenantClient().$transaction(async (tx) => {
                    await tx.numberSequence.create({ data: { key: "own-transaction" } });
                });
                throw new Error("later step failed");
            })),
            /later step failed/,
        );
        assert.equal(await count(), 0, "it must not have been saved on its own");
    });

    it("one transaction does not see another one's unsaved rows", async () => {
        let release!: () => void;
        let started!: () => void;
        const held    = new Promise<void>(resolve => { release = resolve; });
        const writing = new Promise<void>(resolve => { started = resolve; });

        const first = school.run(() => client.withTenantTransaction(async () => {
            await add("from-first");
            started();
            await held;                       // stay open, unsaved, until the second one has looked
        }));

        try {
            await writing;
            const seenBySecond = await school.run(() => client.withTenantTransaction(
                () => client.getTenantClient().numberSequence.count(),
            ));
            assert.equal(seenBySecond, 0);
        } finally {
            release();
            await first;
        }
        assert.equal(await count(), 1);
    });
});
