/*
| SCHOOL BILLING HISTORY against a real database (public schema).
| Runs only when TEST_DATABASE_URL is set (database name must contain "test").
| Seeds two schools, one plan and a spread of invoices, then removes exactly what it created.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "crypto";
import { dbTestsEnabled, skipReason } from "../helpers/test-database";

describe("school billing history (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    const tag = randomBytes(4).toString("hex");
    let prisma: any; let uc: any; let Query: any;
    let A: { id: string }; let B: { id: string }; let plan: { id: string };
    const ids = { invoices: [] as string[], subs: [] as string[] };
    const day = (n: number) => new Date(Date.UTC(2026, 0, n));

    before(async () => {
        ({ prisma } = await import("../../src/infrastructure/database/prisma/prisma.client"));
        const { PlatformInvoicesUseCase } = await import("../../src/modules/subscriptions/usecases/platform/platform-billing.usecases");
        const { SubscriptionMapper } = await import("../../src/modules/subscriptions/mappers/subscription.mapper");
        ({ ListSchoolInvoicesQuery: Query } = await import("../../src/modules/subscriptions/dtos/subscription.dto"));
        uc = new PlatformInvoicesUseCase({ prismaClient: prisma, subscriptionMapper: new SubscriptionMapper() } as any);

        const school = (n: string) => prisma.school.create({ data: { name: `Hist ${n} ${tag}`, subdomain: `hist-${n}-${tag}`, email: `hist-${n}-${tag}@example.test` } });
        A = await school("a"); B = await school("b");
        plan = await prisma.plan.create({ data: { name: `Hist plan ${tag}` } });

        const sub = async (schoolId: string) => {
            const s = await prisma.subscription.create({ data: { schoolId, planId: plan.id, currentPeriodStart: day(1), currentPeriodEnd: day(31) } });
            ids.subs.push(s.id); return s;
        };
        const sA = await sub(A.id); const sB = await sub(B.id);
        // School A: 25 invoices, due dates 1..25; every 5th is paid, every 7th void, the rest open. School B: 3 open.
        const make = async (s: any, schoolId: string, n: number, status: string) => {
            const inv = await prisma.subscriptionInvoice.create({ data: {
                number: `H-${tag}-${schoolId.slice(0, 4)}-${n}`, subscriptionId: s.id, schoolId, planId: plan.id, billingCycle: "monthly", reason: "renewal", status,
                periodStart: day(1), periodEnd: day(31), subtotalKobo: 1000, totalKobo: 1000, dueDate: day(n),
                items: { create: [{ kind: "plan", description: "Plan", amountKobo: 1000 }] } } });
            ids.invoices.push(inv.id);
        };
        for (let n = 1; n <= 25; n++) await make(sA, A.id, n, n % 5 === 0 ? "paid" : n % 7 === 0 ? "void" : "open");
        for (let n = 1; n <= 3; n++) await make(sB, B.id, n, "open");
    });

    after(async () => {
        await prisma.subscriptionInvoiceItem.deleteMany({ where: { invoiceId: { in: ids.invoices } } });
        await prisma.subscriptionInvoice.deleteMany({ where: { id: { in: ids.invoices } } });
        await prisma.subscription.deleteMany({ where: { id: { in: ids.subs } } });
        await prisma.plan.deleteMany({ where: { id: plan.id } });
        await prisma.school.deleteMany({ where: { id: { in: [A.id, B.id] } } });
        const { disconnectPrisma } = await import("../../src/infrastructure/database/prisma/prisma.client");
        await disconnectPrisma();
    });

    it("returns only the requested school's invoices, newest due date first, with items", async () => {
        const r = await uc.listForSchool(A.id, Query.parse({ limit: "100" }));
        assert.equal(r.meta.total, 25);
        assert.ok(r.data.every((i: any) => i.number.includes(A.id.slice(0, 4))), "no invoice from school B");
        assert.deepEqual(r.data.slice(0, 3).map((i: any) => i.number.split("-").pop()), ["25", "24", "23"]);
        assert.deepEqual(r.data[0].items, [{ kind: "plan", description: "Plan", amountKobo: 1000 }]);
    });
    it("status filter counts only that status, within that school", async () => {
        const paid = await uc.listForSchool(A.id, Query.parse({ status: "paid" }));
        assert.equal(paid.meta.total, 5); assert.ok(paid.data.every((i: any) => i.status === "paid"));
        const voided = await uc.listForSchool(A.id, Query.parse({ status: "void" }));
        assert.equal(voided.meta.total, 3);          // 7, 14, 21 (35 is out of range)
        assert.equal((await uc.listForSchool(B.id, Query.parse({ status: "paid" }))).meta.total, 0);
    });
    it("paginates without overlap or gaps and reports the right meta", async () => {
        const p1 = await uc.listForSchool(A.id, Query.parse({ page: "1", limit: "10" }));
        const p2 = await uc.listForSchool(A.id, Query.parse({ page: "2", limit: "10" }));
        const p3 = await uc.listForSchool(A.id, Query.parse({ page: "3", limit: "10" }));
        assert.deepEqual([p1.data.length, p2.data.length, p3.data.length], [10, 10, 5]);
        const all = [...p1.data, ...p2.data, ...p3.data].map((i: any) => i.id);
        assert.equal(new Set(all).size, 25);
        assert.deepEqual(p2.meta, { total: 25, page: 2, limit: 10, totalPages: 3, hasNext: true, hasPrev: true });
        assert.deepEqual(p3.meta, { total: 25, page: 3, limit: 10, totalPages: 3, hasNext: false, hasPrev: true });
        assert.equal((await uc.listForSchool(A.id, Query.parse({ page: "9", limit: "10" }))).data.length, 0);
    });
    it("a real school with no invoices is an empty page, not a 404", async () => {
        const empty = await prisma.school.create({ data: { name: `Hist e ${tag}`, subdomain: `hist-e-${tag}`, email: `hist-e-${tag}@example.test` } });
        try {
            const r = await uc.listForSchool(empty.id, Query.parse({}));
            assert.deepEqual([r.data.length, r.meta.total, r.meta.totalPages], [0, 0, 1]);
        } finally { await prisma.school.delete({ where: { id: empty.id } }); }
    });
    it("an unknown school is 404", async () => {
        await assert.rejects(uc.listForSchool("00000000-0000-4000-8000-000000000000", Query.parse({})), (e: any) => e.statusCode === 404);
    });
});
