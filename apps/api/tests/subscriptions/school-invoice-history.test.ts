import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../../../../packages/contracts/src";
import { PlatformInvoicesUseCase } from "../../src/modules/subscriptions/usecases/platform/platform-billing.usecases";
import { ListSchoolInvoicesQuery } from "../../src/modules/subscriptions/dtos/subscription.dto";
import { SubscriptionMapper } from "../../src/modules/subscriptions/mappers/subscription.mapper";

const row = (o: Record<string, unknown> = {}) => ({
    id: "i1", number: "INV-1", subscriptionId: "sub1", schoolId: "s1", planId: "p1", billingCycle: "monthly", reason: "renewal", status: "paid",
    periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-02-01"), subtotalKobo: 100000, discountKobo: 0, totalKobo: 100000, amountPaidKobo: 100000, couponId: null,
    dueDate: new Date("2026-01-05"), issuedAt: new Date("2026-01-01"), paidAt: new Date("2026-01-02"), voidedAt: null, attemptCount: 0, nextAttemptAt: null, lastFailureReason: null, note: null,
    createdAt: new Date("2026-01-01"), items: [{ id: "x", kind: "plan", description: "Pro plan", amountKobo: 100000 }], school: { name: "Greenfield", subdomain: "green" }, ...o,
});

function build(o: { school?: boolean; rows?: any[]; total?: number } = {}) {
    const seen: any = { count: null, find: null };
    const prismaClient = {
        school: { findUnique: async () => (o.school === false ? null : { id: "s1" }) },
        subscriptionInvoice: { count: async (a: any) => { seen.count = a; return o.total ?? (o.rows ?? [row()]).length; }, findMany: async (a: any) => { seen.find = a; return o.rows ?? [row()]; } },
    };
    return { uc: new PlatformInvoicesUseCase({ prismaClient, subscriptionMapper: new SubscriptionMapper() } as any), seen };
}
const q = (x: Record<string, unknown> = {}) => ListSchoolInvoicesQuery.parse(x);

describe("one school's billing history", () => {
    it("only that school's invoices, newest due date first with a stable tie-break, items included", async () => {
        const { uc, seen } = build();
        await uc.listForSchool("s1", q());
        assert.deepEqual(seen.find.where, { schoolId: "s1" });
        assert.deepEqual(seen.find.orderBy, [{ dueDate: "desc" }, { id: "asc" }]);
        assert.deepEqual([seen.find.skip, seen.find.take, seen.find.include], [0, 20, { items: true }]);
        assert.deepEqual(seen.count.where, { schoolId: "s1" });
    });
    it("a status filter narrows the list and can never widen it past the school", async () => {
        const { uc, seen } = build();
        await uc.listForSchool("s1", q({ status: "open", schoolId: "other" } as any));
        assert.deepEqual(seen.find.where, { schoolId: "s1", status: "open" });
    });
    it("items are the platform invoice shape without the school fields", async () => {
        const out = await build().uc.listForSchool("s1", q());
        assert.deepEqual(Object.keys(out.data[0]).sort(), ["amountPaidKobo", "billingCycle", "discountKobo", "dueDate", "id", "isOverdue", "issuedAt", "items", "lastFailureReason", "note", "number", "paidAt", "periodEnd", "periodStart", "planId", "reason", "status", "subtotalKobo", "totalKobo"]);
        assert.deepEqual(out.data[0].items, [{ kind: "plan", description: "Pro plan", amountKobo: 100000 }]);
    });
    it("page 2 skips one page and meta is right (also for an empty history)", async () => {
        const { uc, seen } = build({ total: 45 });
        const out = await uc.listForSchool("s1", q({ page: "2", limit: "20" }));
        assert.equal(seen.find.skip, 20);
        assert.deepEqual(out.meta, { total: 45, page: 2, limit: 20, totalPages: 3, hasNext: true, hasPrev: true });
        assert.deepEqual((await build({ rows: [], total: 0 }).uc.listForSchool("s1", q())).meta, { total: 0, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false });
    });
    it("an unknown school is 404 and no invoices are read", async () => {
        const { uc, seen } = build({ school: false });
        await assert.rejects(uc.listForSchool("nope", q()), (e: any) => e.statusCode === 404);
        assert.equal(seen.find, null);
    });
    it("query: defaults, limit cap, status values, and the shared schema agrees with the API schema", () => {
        assert.deepEqual([q().page, q().limit, q().status], [1, 20, undefined]);
        assert.throws(() => q({ limit: "101" })); assert.throws(() => q({ status: "pending" }));
        const samples = [{}, { page: "2" }, { limit: "0" }, { limit: "100" }, { status: "open" }, { status: "late" }];
        assert.deepEqual(samples.filter(s => C.ListSchoolInvoicesQuery.safeParse(s).success !== ListSchoolInvoicesQuery.safeParse(s).success), []);
    });
});

describe("billing platform routes (static check)", () => {
    const src = readFileSync("src/modules/subscriptions/routes/billing.platform.routes.ts", "utf8");
    it("the school history needs platform.subscriptions.view and sits before the /:schoolId routes", () => {
        const line = src.split("\n").find(l => l.includes("/schools/:schoolId/invoices")) ?? "";
        assert.match(line, /router\.get/); assert.match(line, /platform\.subscriptions\.view/);
        assert.ok(src.indexOf("/schools/:schoolId/invoices") < src.indexOf('router.get("/:schoolId"'));
    });
});
