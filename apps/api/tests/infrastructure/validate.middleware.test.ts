import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validate, validated } from "../../src/infrastructure/middleware/validate.middleware";
import { errorHandler } from "../../src/infrastructure/middleware/error-handler.middleware";

/* A schema double: coerces page/limit, defaults, strips unknown keys (what ListFeedbackDto does); fails on limit > 100. */
const schema = {
    safeParse(raw: any) {
        const page = raw.page === undefined ? 1 : Number(raw.page), limit = raw.limit === undefined ? 20 : Number(raw.limit);
        if (!(limit <= 100)) return { success: false, error: Object.assign(new Error("bad"), { name: "ZodError", issues: [{ path: ["limit"], message: "Too big" }] }) };
        return { success: true, data: { page, limit } };
    },
} as any;
const res = () => { const r: any = { locals: {}, statusCode: 0, body: null }; r.status = (c: number) => { r.statusCode = c; return r; }; r.json = (b: any) => { r.body = b; return r; }; return r; };

test("REM-113: query defaults and coercion reach the controller; unknown keys are stripped; raw query is untouched", () => {
    const req: any = { query: { limit: "50", junk: "x" } }, rs = res(); let nexted: any = "not called";
    validate(schema, "query")(req, rs, (e?: any) => { nexted = e; });
    assert.equal(nexted, undefined);
    assert.deepEqual(validated(rs, "query", req.query), { page: 1, limit: 50 });
    assert.deepEqual(req.query, { limit: "50", junk: "x" });
});

test("REM-113: params and body parsed results are written back", () => {
    const req: any = { params: { page: "3" }, body: { limit: "10", z: 1 } }, rs = res();
    validate(schema, "params")(req, rs, () => {}); validate(schema, "body")(req, rs, () => {});
    assert.deepEqual(req.params, { page: 3, limit: 20 }); assert.deepEqual(req.body, { page: 1, limit: 10 });
    assert.deepEqual(validated(rs, "params"), { page: 3, limit: 20 });
});

test("validated() falls back to the raw value when the route did not validate", () => {
    assert.deepEqual(validated(res(), "query", { a: "1" }), { a: "1" });
});

test("REM-114: a validation failure goes through the global handler with the common envelope", () => {
    const req: any = { query: { limit: "500" }, method: "GET", originalUrl: "/x" }, rs = res(); let err: any;
    validate(schema, "query")(req, rs, (e?: any) => { err = e; });
    assert.ok(err); assert.equal(rs.statusCode, 0);                    // the middleware does not answer by itself
    const out = res(); errorHandler(err, req, out, () => {});
    assert.equal(out.statusCode, 400);
    assert.deepEqual(out.body, { success: false, message: "Validation failed", code: "VALIDATION_ERROR", errors: { limit: "Too big" } });
});

test("REM-114: unknown route and every rate limiter carry stable codes", () => {
    const app = readFileSync(join(__dirname, "../../src/app.ts"), "utf8");
    assert.match(app, /code:\s*"ROUTE_NOT_FOUND"/);
    const rl = readFileSync(join(__dirname, "../../src/infrastructure/middleware/rate-limit.middleware.ts"), "utf8");
    const messages = rl.match(/message:\s*\{[^}]*\}/g) ?? [];
    assert.ok(messages.length >= 6);
    for (const m of messages) assert.match(m, /code:\s*"RATE_LIMITED"/);
});

test("the feedback list reads the parsed query", () => {
    const c = readFileSync(join(__dirname, "../../src/modules/feedback/controllers/feedback.controller.ts"), "utf8");
    assert.match(c, /validated<ListFeedbackDtoType>\(res, "query", req\.query\)/);
});
