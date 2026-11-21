import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { EntitlementsService } from "../../src/foundation/entitlements.service";
import { MyPermissionsUseCase } from "../../src/modules/user/usecases/my-permissions.usecase";

const defs = [
    { key: "modules.grades", kind: "BOOLEAN", meterKey: null, enforcement: "BLOCK", isActive: true },
    { key: "notifications.sms", kind: "BOOLEAN", meterKey: null, enforcement: "BLOCK", isActive: true },
    { key: "grading.custom", kind: "BOOLEAN", meterKey: null, enforcement: "BLOCK", isActive: false },     // not enforced yet
    { key: "students.max", kind: "LIMIT", meterKey: "students.active", enforcement: "BLOCK", isActive: true },
    { key: "staff.max", kind: "LIMIT", meterKey: "staff.active", enforcement: "BLOCK", isActive: true },
    { key: "branches.max", kind: "LIMIT", meterKey: "branches.active", enforcement: "BLOCK", isActive: true },
] as any[];
const db = (sub: any = { planId: "p1", status: "active" }) => ({
    subscription: { findFirst: async () => sub },
    planEntitlement: { findMany: async () => [
        { featureKey: "modules.grades", boolValue: true, limitValue: null, enumValue: null },
        { featureKey: "students.max", boolValue: null, limitValue: 100, enumValue: null },
        { featureKey: "staff.max", boolValue: null, limitValue: null, enumValue: null },          // unlimited
    ] },
    schoolEntitlementOverride: { findMany: async () => [{ featureKey: "notifications.sms", boolValue: true, limitValue: null, enumValue: null, expiresAt: null }] },
    featureDefinition: { findMany: async () => defs },
}) as any;
const svc = (sub?: any) => new EntitlementsService(db(sub), { meters: { "students.active": async () => 42, "staff.active": async () => { throw new Error("boom"); } } });
const A = (persona: any, realm: any = "school") => new Access(realm, "u1", "m1", persona, "x1", new Set(["r"]), false, new Map(), new Set());
const run = (a: Access, s: any, school: string | null = "sch1") => new MyPermissionsUseCase({ entitlementsService: s }, async () => []).execute(a, school);
const f = (out: any, k: string) => out.entitlements.features.find((x: any) => x.key === k);

describe("GET /users/me/permissions: school entitlements", () => {
    it("staff see what the plan grants, overrides, caps and usage", async () => {
        const out = await run(A("STAFF"), svc());
        assert.equal(out.entitlements!.subscribed, true); assert.equal(out.entitlements!.status, "active");
        assert.deepEqual([f(out, "modules.grades").granted, f(out, "modules.grades").source], [true, "plan"]);
        assert.deepEqual([f(out, "notifications.sms").granted, f(out, "notifications.sms").source], [true, "override"]);
        assert.equal(f(out, "students.max").value, 100); assert.equal(f(out, "students.max").current, 42);
        assert.equal(f(out, "staff.max").unlimited, true); assert.equal(f(out, "staff.max").current, null);   // a failing meter does not break the response
        assert.deepEqual([f(out, "branches.max").granted, f(out, "branches.max").value], [false, 0]);         // no row = not granted
    });
    it("a feature the platform does not enforce yet is open to everyone", async () => {
        const out = await run(A("STAFF"), svc());
        assert.deepEqual([f(out, "grading.custom").enforced, f(out, "grading.custom").granted], [false, true]);
    });
    it("students and guardians see on/off only: no caps, no usage, no plan status", async () => {
        for (const p of ["STUDENT", "GUARDIAN"]) {
            const out = await run(A(p), svc());
            assert.equal(out.entitlements!.status, null);
            assert.equal(f(out, "modules.grades").granted, true);
            assert.equal(f(out, "students.max").value, null); assert.equal(f(out, "students.max").current, null);
            assert.equal(f(out, "staff.max").unlimited, false);
        }
    });
    it("no subscription: nothing enforced is granted", async () => {
        const out = await run(A("STAFF"), svc(null));
        assert.equal(out.entitlements!.subscribed, false);
        assert.equal(f(out, "modules.grades").granted, false);
        assert.equal(f(out, "grading.custom").granted, true);
    });
    it("platform sessions and calls without a school get null; the rest of the response is unchanged", async () => {
        assert.equal((await run(A(null, "platform"), svc())).entitlements, null);
        assert.equal((await run(A("STAFF"), svc(), null)).entitlements, null);
        assert.equal((await new MyPermissionsUseCase({}, async () => []).execute(A("STAFF"), "sch1")).entitlements, null);
    });
});
