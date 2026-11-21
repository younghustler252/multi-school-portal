import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PlatformInvoicesUseCase } from "../../src/modules/subscriptions/usecases/platform/platform-billing.usecases";
import { SubscriptionMapper } from "../../src/modules/subscriptions/mappers/subscription.mapper";

const NOW = new Date("2026-11-22T10:00:00Z");
const inv = (id: string, schoolId: string, status: string, o: any = {}) => ({
    id, number: "INV-" + id, subscriptionId: "sub-" + schoolId, schoolId, planId: "p1", billingCycle: "monthly", reason: "renewal", status,
    periodStart: new Date("2026-10-01"), periodEnd: new Date("2026-11-01"), subtotalKobo: 500000, discountKobo: 0, totalKobo: 500000, amountPaidKobo: status === "paid" ? 500000 : 0,
    couponId: null, dueDate: new Date("2026-10-08"), issuedAt: new Date("2026-10-01"), paidAt: null, voidedAt: null, attemptCount: 0, nextAttemptAt: null,
    lastFailureReason: "card declined", note: null, createdAt: new Date("2026-10-01"),
    items: [{ id: "i" + id, kind: "plan", description: "Plan", amountKobo: 500000 }],
    attempts: [{ id: "a" + id, reference: "ref-" + id, amountKobo: 500000, status: "failed", method: "card", failureReason: "declined", createdAt: new Date("2026-10-02"), completedAt: null,
        providerStatus: "RAW-PROVIDER-DATA", paymentMethodId: "pm1" }],
    ...o,
});
const ALL = [inv("1", "A", "paid", { issuedAt: new Date("2026-09-01") }), inv("2", "A", "open", { issuedAt: new Date("2026-10-01") }), inv("3", "A", "void", { issuedAt: new Date("2026-08-01") }), inv("4", "B", "open")];

function uc() {
    const calls: any = {};
    const prismaClient: any = {
        school: { findUnique: async ({ where }: any) => where.id === "A" ? { id: "A", name: "Alpha", subdomain: "alpha" } : null },
        subscriptionInvoice: {
            count: async ({ where }: any) => ALL.filter(r => r.schoolId === where.schoolId && (!where.status || r.status === where.status)).length,
            findMany: async ({ where, orderBy, skip, take }: any) => { calls.where = where; calls.orderBy = orderBy; return ALL.filter(r => r.schoolId === where.schoolId && (!where.status || r.status === where.status))
                .sort((a, b) => +b.issuedAt - +a.issuedAt).slice(skip, skip + take); },
            groupBy: async ({ where }: any) => {
                const g: any = {};
                for (const r of ALL.filter(x => x.schoolId === where.schoolId)) { g[r.status] ??= { status: r.status, _count: { _all: 0 }, _sum: { totalKobo: 0, amountPaidKobo: 0 } }; g[r.status]._count._all++; g[r.status]._sum.totalKobo += r.totalKobo; g[r.status]._sum.amountPaidKobo += r.amountPaidKobo; }
                return Object.values(g);
            },
        },
    };
    return { uc: new PlatformInvoicesUseCase({ prismaClient, subscriptionMapper: new SubscriptionMapper() } as any), calls };
}

test("one school's invoices, newest first, with items and attempts; another school's never appear", async () => {
    const { uc: u, calls } = uc();
    const r = await u.listForSchool("A", { page: 1, limit: 20 } as any, NOW);
    assert.deepEqual(r.data.map(x => x.id), ["2", "1", "3"]);
    assert.equal(calls.where.schoolId, "A");
    assert.equal(r.data[0].items.length, 1);
    assert.deepEqual(Object.keys(r.data[0].attempts[0]).sort(), ["amountKobo", "completedAt", "createdAt", "failureReason", "id", "method", "reference", "status"]);   // no provider payload, no saved-method id
    assert.equal(JSON.stringify(r).includes("RAW-PROVIDER-DATA"), false);
});

test("summary covers the whole history, not the page or the status filter", async () => {
    const { uc: u } = uc();
    const r = await u.listForSchool("A", { page: 1, limit: 1, status: "paid" } as any, NOW);
    assert.equal(r.data.length, 1); assert.equal(r.meta.total, 1);
    assert.deepEqual(r.summary, { invoiceCount: 3, paidCount: 1, openCount: 1, paidKobo: 500000, outstandingKobo: 500000 });
    const p2 = await u.listForSchool("A", { page: 2, limit: 2 } as any, NOW);
    assert.deepEqual([p2.data.length, p2.meta.hasPrev, p2.meta.hasNext, p2.meta.totalPages], [1, true, false, 2]);
});

test("an unknown school is a 404, and the route is platform.subscriptions.view after the fixed paths", async () => {
    await assert.rejects(uc().uc.listForSchool("nope", { page: 1, limit: 20 } as any, NOW), /not found|no subscription/i);
    const r = readFileSync(join(__dirname, "../../src/modules/subscriptions/routes/billing.platform.routes.ts"), "utf8");
    assert.match(r, /router\.get\("\/:schoolId\/invoices", authenticate, requirePermission\("platform\.subscriptions\.view"\)/);
    assert.ok(r.indexOf('"/invoices"') < r.indexOf('"/:schoolId/invoices"'));
});
