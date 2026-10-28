import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildAuditFailureReport, auditFailureSink } from "../../src/modules/audit/services/audit-failure-reporter";
import { AuditService } from "../../src/modules/audit/services/audit.service";
import { AuthAuditService } from "../../src/modules/auth/services/auth-audit.service";

describe("what an audit failure report contains", () => {
    it("tags it, groups it per module, and carries identifiers only", () => {
        const r = buildAuditFailureReport({ source: "audit", action: "student.updated", entity: "Student", entityId: "s1", schoolId: "sch", userId: "u1", requestId: "r1" });
        assert.deepEqual(r.tags, { audit_failed: "true", audit_source: "audit", audit_module: "student" });
        assert.deepEqual(r.fingerprint, ["audit-log-failed", "audit", "student"]);
        assert.deepEqual(Object.keys(r.extra).sort(), ["action", "entity", "entityId", "requestId", "schoolId", "userId"]);
        assert.equal(JSON.stringify(r).includes("oldValue"), false);
    });
    it("missing details are null, not invented", () => {
        const r = buildAuditFailureReport({ source: "auth-audit", action: "auth.login_failed" });
        assert.equal(r.extra.entityId, null); assert.equal(r.extra.schoolId, null); assert.equal(r.tags.audit_module, "auth");
    });
});

describe("a failed audit write is reported, never thrown", () => {
    const real = auditFailureSink.report;
    let seen: { err: unknown; ctx: any }[] = [];
    let quiet: typeof console.error;
    beforeEach(() => { seen = []; auditFailureSink.report = (err, ctx) => { seen.push({ err, ctx }); }; quiet = console.error; console.error = () => undefined; });
    afterEach(() => { auditFailureSink.report = real; console.error = quiet; });

    it("AuditService: the caller carries on, and the loss is reported with its context", async () => {
        const boom = new Error("audit table down");
        const svc = new AuditService({ auditRepository: { create: async () => { throw boom; } } as any });
        await assert.doesNotReject(() => svc.log({ userId: "u1", schoolId: "sch", action: "fees.invoice_created", entity: "Invoice", entityId: "i1", newValue: { secret: "x" } }));
        assert.equal(seen.length, 1); assert.equal(seen[0].err, boom);
        assert.deepEqual(seen[0].ctx, { source: "audit", action: "fees.invoice_created", entity: "Invoice", entityId: "i1", schoolId: "sch", userId: "u1", requestId: undefined });
        assert.equal(JSON.stringify(seen[0].ctx).includes("secret"), false);
    });
    it("AuditService: nothing is reported when the write works", async () => {
        const svc = new AuditService({ auditRepository: { create: async () => ({}) } as any });
        await svc.log({ userId: "u1", action: "student.created", entity: "Student" });
        assert.equal(seen.length, 0);
    });
    it("AuthAuditService: a failed sign-in/security entry is reported too, and sign-in is not broken", async () => {
        const svc = new AuthAuditService({ prismaClient: { auditLog: { create: async () => { throw new Error("db down"); } } } as any });
        await assert.doesNotReject(() => svc.record({ action: "auth.login", userId: "u1", schoolId: "sch" } as any));
        assert.equal(seen.length, 1); assert.equal(seen[0].ctx.source, "auth-audit"); assert.equal(seen[0].ctx.action, "auth.login");
    });
    it("a reporter that itself breaks does not break the audit call", async () => {
        auditFailureSink.report = real;
        const svc = new AuditService({ auditRepository: { create: async () => { throw new Error("x"); } } as any });
        await assert.doesNotReject(() => svc.log({ action: "a.b", entity: "E" }));
    });
});
