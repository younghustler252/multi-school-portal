import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { EntitlementsService } from "../../src/foundation/entitlements.service";
import { FEATURE_REGISTRY } from "../../src/foundation/features.registry";
import { MyPermissionsUseCase } from "../../src/modules/user/usecases/my-permissions.usecase";
import { accessOf, type MyPermissions } from "../../../../packages/contracts/src/me-permissions";

const def = (f: (typeof FEATURE_REGISTRY)[number], over: Record<string, unknown> = {}) =>
    ({ key: f.key, kind: f.kind, meterKey: f.meterKey ?? null, enforcement: "BLOCK", isActive: f.isActive !== false, ...over }) as any;
const defs = (over: Record<string, Record<string, unknown>> = {}) => FEATURE_REGISTRY.map(f => def(f, over[f.key]));

function service(opts: { sub?: boolean; plan?: any[]; overrides?: any[]; defs?: any[] } = {}) {
    const db: any = {
        subscription: { findFirst: async () => (opts.sub === false ? null : { planId: "p1", status: "active" }) },
        planEntitlement: { findMany: async () => opts.plan ?? [] },
        schoolEntitlementOverride: { findMany: async () => opts.overrides ?? [] },
        featureDefinition: { findMany: async () => opts.defs ?? defs() },
    };
    return new EntitlementsService(db);
}
const plan = (featureKey: string, o: Record<string, unknown>) => ({ featureKey, boolValue: null, limitValue: null, enumValue: null, ...o });

describe("effective entitlement flags", () => {
    it("lists every registry feature, so no key is ever missing", async () => {
        const flags = await service({ plan: [] }).effectiveFlags("s1");
        assert.deepEqual(Object.keys(flags).sort(), FEATURE_REGISTRY.map(f => f.key).sort());
    });
    it("yes/no features follow the plan; limits carry the cap and nothing about usage", async () => {
        const flags = await service({ plan: [plan("modules.fees", { boolValue: true }), plan("modules.grades", { boolValue: false }), plan("students.max", { limitValue: 500 }), plan("staff.max", { limitValue: null })] }).effectiveFlags("s1");
        assert.equal(flags["modules.fees"], true);
        assert.equal(flags["modules.grades"], false);
        assert.equal(flags["modules.attendance"], false);
        assert.deepEqual(flags["students.max"], { allowed: true, limit: 500 });
        assert.deepEqual(flags["staff.max"], { allowed: true, limit: null });
        assert.deepEqual((flags as any)["automation.rules.max"], { allowed: false, limit: 0 });
    });
    it("a school override wins over the plan, in both directions, and an expired one is ignored", async () => {
        const past = new Date(Date.now() - 1000), future = new Date(Date.now() + 86_400_000);
        const flags = await service({
            plan: [plan("modules.fees", { boolValue: false }), plan("grading.custom", { boolValue: true }), plan("report_cards.pdf", { boolValue: true })],
            overrides: [{ ...plan("modules.fees", { boolValue: true }), expiresAt: future }, { ...plan("grading.custom", { boolValue: false }), expiresAt: null }, { ...plan("report_cards.pdf", { boolValue: false }), expiresAt: past }],
        }).effectiveFlags("s1");
        assert.equal(flags["modules.fees"], true);
        assert.equal(flags["grading.custom"], false);
        assert.equal(flags["report_cards.pdf"], true);
    });
    it("features the platform has not switched on are false even if the plan row says yes (inactive features are reported as false)", async () => {
        const inactive = FEATURE_REGISTRY.filter(f => f.isActive === false).map(f => f.key);
        assert.ok(inactive.length >= 5);
        const flags = await service({ plan: inactive.map(k => plan(k, { boolValue: true, limitValue: 10 })) }).effectiveFlags("s1");
        for (const k of inactive) assert.ok(flags[k] === false || (flags[k] as any).allowed === false, k);
    });
    it("a feature the console switched off (or on) is read from the database definition, not the code default", async () => {
        const flags = await service({ plan: [plan("security.two_factor", { boolValue: true }), plan("modules.fees", { boolValue: true })], defs: defs({ "security.two_factor": { isActive: true }, "modules.fees": { isActive: false } }) }).effectiveFlags("s1");
        assert.equal(flags["security.two_factor"], true);
        assert.equal(flags["modules.fees"], false);
    });
    it("a school with no live subscription gets every feature as false", async () => {
        const flags = await service({ sub: false, plan: [plan("modules.fees", { boolValue: true })] }).effectiveFlags("s1");
        assert.ok(Object.values(flags).every(v => v === false || (typeof v === "object" && v.allowed === false)));
    });
    it("agrees with checkFeature for every active yes/no feature", async () => {
        const s = service({ plan: [plan("modules.fees", { boolValue: true }), plan("notifications.sms", { boolValue: false })], overrides: [{ ...plan("notifications.sms", { boolValue: true }), expiresAt: null }] });
        const flags = await s.effectiveFlags("s1");
        for (const f of FEATURE_REGISTRY.filter(f => f.kind === "BOOLEAN" && f.isActive !== false)) assert.equal(flags[f.key], (await s.checkFeature("s1", f.key)).allowed, f.key);
    });
    it("a feature the platform console added that the code does not know is listed too", async () => {
        const extra = { key: "beta.thing", kind: "BOOLEAN", meterKey: null, enforcement: "BLOCK", isActive: true };
        const flags = await service({ plan: [plan("beta.thing", { boolValue: true })], defs: [...defs(), extra] as any }).effectiveFlags("s1");
        assert.equal(flags["beta.thing"], true);
    });
    it("contains nothing but booleans and { allowed, limit } (no billing fields can leak)", async () => {
        const flags = await service({ plan: [plan("students.max", { limitValue: 5 })] }).effectiveFlags("s1");
        for (const v of Object.values(flags)) assert.ok(typeof v === "boolean" || (Object.keys(v).sort().join() === "allowed,limit"));
    });
});

const staff = new Access("school", "u1", "m1", "STAFF", null, new Set(["x"]), true, new Map());
describe("readiness is reported separately from plan entitlement", () => {
    it("notReadyFeatures lists exactly the inactive features, sorted, and follows the console definition", async () => {
        const fromCode = FEATURE_REGISTRY.filter(f => f.isActive === false).map(f => f.key).sort();
        assert.deepEqual(await service().notReadyFeatures(), fromCode);
        const changed = await service({ defs: defs({ "security.two_factor": { isActive: true }, "modules.fees": { isActive: false } }) }).notReadyFeatures();
        assert.ok(changed.includes("modules.fees")); assert.ok(!changed.includes("security.two_factor"));
    });
    it("the documented difference is real: an inactive feature is false here but the server gate still allows it; an active one the plan lacks is false and denied", async () => {
        const s = service({ plan: [plan("security.two_factor", { boolValue: true })] });
        assert.equal((await s.effectiveFlags("s1"))["security.two_factor"], false);
        assert.equal((await s.checkFeature("s1", "security.two_factor")).allowed, true);      // readiness, not a 403
        assert.equal((await s.effectiveFlags("s1"))["grading.custom"], false);
        assert.equal((await s.checkFeature("s1", "grading.custom")).allowed, false);         // plan entitlement: 403
        assert.ok(!(await s.notReadyFeatures()).includes("grading.custom"));
    });
    it("every key that is false because it is not ready is in the list, and nothing active is", async () => {
        const s = service({ plan: FEATURE_REGISTRY.map(f => plan(f.key, { boolValue: true, limitValue: 10 })) });
        const flags = await s.effectiveFlags("s1"); const notReady = new Set(await s.notReadyFeatures());
        for (const [k, v] of Object.entries(flags)) { const on = typeof v === "object" ? v.allowed : v; assert.equal(!on, notReady.has(k), k); }
    });
});

describe("GET /users/me/permissions carries entitlements", () => {
    it("a school session gets the flags for its own school", async () => {
        let asked = "";
        const out = await new MyPermissionsUseCase({}, async () => [], async (id) => { asked = id; return { "modules.fees": true }; }, async () => ["api.access"]).execute(staff, "s1");
        assert.equal(asked, "s1");
        assert.deepEqual(out.entitlements, { "modules.fees": true });
        assert.deepEqual(out.entitlementsNotReady, ["api.access"]);
    });
    it("a platform session has none and reads none", async () => {
        const a = new Access("platform", "u9", "pm1", null, null, new Set(["super_admin"]), false, new Map());
        let asked = false;
        const out = await new MyPermissionsUseCase({}, async () => [], async () => { asked = true; return {}; }).execute(a);
        assert.equal(out.entitlements, null); assert.equal(out.entitlementsNotReady, null); assert.equal(asked, false);
    });
    it("the helper reads boolean and limit flags", () => {
        const me = accessOf({ realm: "school", persona: "STAFF", roles: [], holdsEverything: false, permissions: [], branches: { all: [], assigned: [], schoolHasSeveral: false },
            entitlementsNotReady: [], entitlements: { "modules.fees": true, "grading.custom": false, "students.max": { allowed: true, limit: 10 }, "staff.max": { allowed: false, limit: 0 } } } as MyPermissions);
        assert.deepEqual(["modules.fees", "grading.custom", "students.max", "staff.max", "nope"].map(me.hasFeature), [true, false, true, false, false]);
    });
});
