/* REM-112: the request context is mounted FIRST and does its job. The behaviour tests need no database; the HTTP one uses a real Express app. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requestContext } from "../../src/infrastructure/middleware/request-context.middleware";
import { RequestContext } from "../../src/shared/context/request-context";

const run = (headers: Record<string, string> = {}, ip = "10.0.0.7") => {
    const sent: Record<string, string> = {}; let inside: any; let after: any;
    const req: any = { get: (h: string) => headers[h.toLowerCase()], ip, socket: { remoteAddress: "9.9.9.9" } };
    const res: any = { setHeader: (k: string, v: string) => { sent[k.toLowerCase()] = v; } };
    requestContext(req, res, () => { inside = RequestContext.get(); RequestContext.setActor({ userId: "u1", membershipId: "m1", impersonatedBy: "platform-9" }); after = { ...RequestContext.get() }; });
    return { sent, inside, after, outside: RequestContext.get() };
};

describe("requestContext middleware", () => {
    it("generates an id, returns it as x-request-id and opens the store with ip and user agent", () => {
        const r = run({ "user-agent": "jest/1" });
        assert.match(r.sent["x-request-id"], /^[0-9a-f-]{36}$/);
        assert.deepEqual([r.inside.requestId, r.inside.ip, r.inside.userAgent], [r.sent["x-request-id"], "10.0.0.7", "jest/1"]);
        assert.equal(r.outside, undefined);                                   // nothing leaks outside the request
    });
    it("keeps a safe caller-supplied id and replaces an unsafe one", () => {
        assert.equal(run({ "x-request-id": "trace-abc_123.9" }).sent["x-request-id"], "trace-abc_123.9");
        for (const bad of ["short", "has space in it!!", "x".repeat(65), "a\r\nb-header-inject"]) assert.notEqual(run({ "x-request-id": bad }).sent["x-request-id"], bad);
    });
    it("authenticate's setActor now takes effect inside the request", () => {
        const r = run();
        assert.deepEqual([r.after.userId, r.after.membershipId, r.after.impersonatedBy], ["u1", "m1", "platform-9"]);
    });
    it("without the middleware setActor is a silent no-op (the bug this fixes): no store, no actor", () => {
        RequestContext.setActor({ userId: "u", membershipId: null }); assert.equal(RequestContext.get(), undefined);
    });
    it("the audit log picks the request id, actor and impersonator up with no change to its callers", async () => {
        const { AuditService } = await import("../../src/modules/audit/services/audit.service");   // loaded here so the other tests run without its dependencies
        const rows: any[] = []; const audit = new AuditService({ auditRepository: { create: async (r: any) => { rows.push(r); } } as any });
        const sent: Record<string, string> = {};
        const req: any = { get: () => undefined, ip: "1.2.3.4", socket: {} }; const res: any = { setHeader: (k: string, v: string) => { sent[k] = v; } };
        await new Promise<void>(resolve => requestContext(req, res, () => { RequestContext.setActor({ userId: "u1", membershipId: "m1", impersonatedBy: "platform-9" }); audit.log({ action: "x.y", entity: "X", entityId: "1", schoolId: "s1" } as any).then(resolve); }));
        assert.equal(rows.length, 1);
        assert.deepEqual([rows[0].userId, rows[0].actorMembershipId, rows[0].requestId, rows[0].ipAddress ?? rows[0].ip], ["u1", "m1", sent["x-request-id"], "1.2.3.4"]);
        assert.equal(rows[0].metadata?.impersonatedBy, "platform-9");
    });
});

describe("app wiring (static)", () => {
    const app = readFileSync(join(__dirname, "../../src/app.ts"), "utf8");
    const at = (needle: string) => { const i = app.indexOf(needle); assert.ok(i > 0, needle); return i; };
    it("requestContext is the first middleware: before helmet, cors, the webhook entry, the global limiter and optional auth", () => {
        const ctx = at("app.use(requestContext)");
        for (const later of ["app.use(\n\thelmet(", "app.use(cors(", 'app.use("/api/v1/webhooks"', "app.use(globalLimiter)", "app.use(optionalAuthenticate)", "app.use(resolveTenant)"]) assert.ok(ctx < at(later), `before ${later}`);
        assert.equal(app.split("app.use(").findIndex(p => p.startsWith("requestContext")), 1, "no other app.use before it");
    });
    it("the browser may read x-request-id (CORS exposedHeaders)", () => assert.match(app, /exposedHeaders: \["x-request-id"\]/));
});
