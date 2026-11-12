import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { Access } from "../../src/foundation/access.service";
import { SYSTEM_EVENT_TYPES } from "../../src/modules/events/domain/event-type.catalog";
import { MAX_CUSTOM_EVENT_TYPES, cleanName, keyCandidate, nameKeyOf, slugOf, assertChangeAllowed, assertCanDelete } from "../../src/modules/events/domain/event-type.policy";
import { eventTypeErrors } from "../../src/modules/events/domain/event-type.errors";
import { EventTypeMapper } from "../../src/modules/events/mappers/event-type.mapper";
import { CreateEventTypeUseCase, DeleteEventTypeUseCase, ListEventTypesUseCase, UpdateEventTypeUseCase } from "../../src/modules/events/usecases/event-types.usecases";

const code = (c: string) => ({ code: c });
const actor = { userId: "admin-1" };

describe("events.types.manage permission", () => {
    const perm = () => PERMISSION_REGISTRY.find(p => p.key === "events.types.manage");
    it("exists once, school-wide only, staff only, and the registry stays valid", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        assert.equal(PERMISSION_REGISTRY.filter(p => p.key === "events.types.manage").length, 1);
        assert.deepEqual([...perm()!.scopes], ["ALL"]);
        assert.deepEqual([...perm()!.personas!], ["STAFF"]);
    });
    it("no role template grants it: not principal, not branch principal, not anyone (the School Admin holds it through grant-everything)", () => {
        for (const t of ROLE_TEMPLATES) assert.ok(!t.permissions.some(p => p.key === "events.types.manage"), `${t.key} must not carry events.types.manage`);
        assert.equal(ROLE_TEMPLATES.find(t => t.key === "school_admin")!.grantsAll, true);
    });
    it("Access: the school admin can, a principal-like holder of other event permissions cannot", () => {
        const admin = new Access("school", "u", "m", "STAFF", "s", new Set(["school_admin"]), true, new Map());
        const principal = new Access("school", "u", "m", "STAFF", "s", new Set(["principal"]), false, new Map([["events.manage", "ALL"], ["events.publish", "ALL"]]) as any);
        const student = new Access("school", "u", "m", "STUDENT", "s", new Set(["student"]), false, new Map());
        assert.equal(admin.can("events.types.manage"), true);
        assert.equal(principal.can("events.types.manage"), false);
        assert.equal(student.can("events.types.manage"), false);
    });
});

describe("event type policy", () => {
    it("names: trimmed, spaces collapsed, compared without case", () => {
        assert.equal(cleanName("  Inter-house   Quiz "), "Inter-house Quiz");
        assert.equal(nameKeyOf("  INTER-house   quiz "), "inter-house quiz");
    });
    it("keys are slugs of 2-40 characters, with -2, -3 on a clash", () => {
        assert.equal(slugOf("Inter-house Quiz!"), "inter-house-quiz");
        assert.equal(slugOf("Café Day"), "cafe-day");
        assert.match(slugOf("!!"), /^[a-z0-9]+(-[a-z0-9]+)*$/);
        assert.match(slugOf("日本"), /^[a-z0-9]+(-[a-z0-9]+)*$/);
        assert.ok(slugOf("x".repeat(100)).length <= 40);
        assert.equal(keyCandidate("quiz", 0), "quiz"); assert.equal(keyCandidate("quiz", 1), "quiz-2"); assert.equal(keyCandidate("quiz", 2), "quiz-3");
    });
    it("system types: colour and icon are free, name and state are locked (a same-name no-op is fine)", () => {
        const sys = { isSystem: true, name: "Exam", isActive: true };
        assertChangeAllowed(sys, { color: "#000000", icon: "book" });
        assertChangeAllowed(sys, { name: "  Exam ", isActive: true });
        assert.throws(() => assertChangeAllowed(sys, { name: "Tests" }), code("EVENT_TYPE_PROTECTED"));
        assert.throws(() => assertChangeAllowed(sys, { isActive: false }), code("EVENT_TYPE_PROTECTED"));
        assertChangeAllowed({ isSystem: false, name: "Quiz", isActive: true }, { name: "Quiz Day", isActive: false });
    });
    it("delete: never a system type, never one in use", () => {
        assert.throws(() => assertCanDelete({ isSystem: true }, 0), code("EVENT_TYPE_PROTECTED"));
        assert.throws(() => assertCanDelete({ isSystem: false }, 3), code("EVENT_TYPE_IN_USE"));
        assertCanDelete({ isSystem: false }, 0);
    });
    it("every error carries its stable code and status", () => {
        const e = eventTypeErrors;
        const table: [any, string, number][] = [[e.notFound(), "NOT_FOUND", 404], [e.nameTaken(), "EVENT_TYPE_NAME_TAKEN", 409], [e.protected(), "EVENT_TYPE_PROTECTED", 409], [e.inUse(2), "EVENT_TYPE_IN_USE", 409], [e.inactive(), "EVENT_TYPE_INACTIVE", 409], [e.limit(50), "EVENT_TYPE_LIMIT", 409]];
        for (const [err, c, status] of table) { assert.equal(err.statusCode, status); if (c !== "NOT_FOUND") assert.equal(err.code, c); }
    });
});

/* An in-memory stand-in for the repository. lockForCreate really serialises: the second caller waits until the first one's transaction ends. */
function world(preCustom = 0) {
    const rows = new Map<string, any>(); let n = 0; const audits: any[] = []; const events = new Map<string, number>();
    for (const t of SYSTEM_EVENT_TYPES) rows.set(t.id, { ...t, color: null, icon: null, isSystem: true, isActive: true, createdById: null, createdAt: new Date(), updatedAt: new Date() });
    const add = (name: string, key: string) => { const id = `c${++n}`; rows.set(id, { id, key, name, nameKey: nameKeyOf(name), color: null, icon: null, isSystem: false, isActive: true, createdById: "x", createdAt: new Date(), updatedAt: new Date() }); return id; };
    for (let i = 0; i < preCustom; i++) add(`Pre ${i}`, `pre-${i}`);
    let held: Promise<void> | null = null; let release: () => void = () => {};
    const all = () => [...rows.values()];
    const eventTypeRepository: any = {
        findAll: async (inc: boolean) => all().filter(r => inc || r.isActive),
        findById: async (id: string) => rows.get(id) ?? null,
        findByKey: async (key: string) => all().find(r => r.key === key) ?? null,
        countCustom: async () => all().filter(r => !r.isSystem).length,
        lockForCreate: async () => { while (held) await held; held = new Promise<void>(r => { release = () => { held = null; r(); }; }); },
        create: async (d: any) => { if (all().some(r => r.nameKey === d.nameKey)) throw eventTypeErrors.nameTaken(); const id = add(d.name, d.key); Object.assign(rows.get(id), d); return rows.get(id); },
        update: async (id: string, c: any) => { if (c.nameKey && all().some(r => r.id !== id && r.nameKey === c.nameKey)) throw eventTypeErrors.nameTaken(); Object.assign(rows.get(id), c); return rows.get(id); },
        countEventsUsing: async (id: string) => events.get(id) ?? 0,
        remove: async (id: string) => { rows.delete(id); },
    };
    const runInTransaction = async (fn: () => Promise<any>) => { try { return await fn(); } finally { release(); } };
    const auditService: any = { log: async (p: any) => { audits.push(p); } };
    const deps: any = { eventTypeRepository, eventTypeMapper: new EventTypeMapper(), auditService, runInTransaction };
    return { rows, audits, events, deps, customCount: () => all().filter(r => !r.isSystem).length };
}

describe("event type use cases", () => {
    it("create: makes a custom active type with a slug key, audits, and returns the response shape", async () => {
        const w = world();
        const t = await new CreateEventTypeUseCase(w.deps).execute("s1", { name: "  Inter-house   Quiz ", color: "#12AB34", icon: "trophy" }, actor);
        assert.deepEqual({ key: t.key, name: t.name, color: t.color, icon: t.icon, isSystem: t.isSystem, isActive: t.isActive }, { key: "inter-house-quiz", name: "Inter-house Quiz", color: "#12AB34", icon: "trophy", isSystem: false, isActive: true });
        assert.equal(w.audits[0].action, "event_type.created");
    });
    it("create: the same name in another case or spacing is refused; a system name too", async () => {
        const w = world(); const uc = new CreateEventTypeUseCase(w.deps);
        await uc.execute("s1", { name: "Quiz" } as any, actor);
        await assert.rejects(uc.execute("s1", { name: " QUIZ " } as any, actor), code("EVENT_TYPE_NAME_TAKEN"));
        await assert.rejects(uc.execute("s1", { name: "exam" } as any, actor), code("EVENT_TYPE_NAME_TAKEN"));
    });
    it("create: a slug that clashes with a system key gets a suffix, and a custom clash too", async () => {
        const w = world(); const uc = new CreateEventTypeUseCase(w.deps);
        assert.equal((await uc.execute("s1", { name: "Exam!" } as any, actor)).key, "exam-2");
        assert.equal((await uc.execute("s1", { name: "Exam?" } as any, actor)).key, "exam-3");
    });
    it(`create: at most ${MAX_CUSTOM_EVENT_TYPES} custom types; inactive ones count; deleting frees a slot`, async () => {
        const w = world(MAX_CUSTOM_EVENT_TYPES - 1); const uc = new CreateEventTypeUseCase(w.deps);
        const last = await uc.execute("s1", { name: "Last one" } as any, actor);
        await assert.rejects(uc.execute("s1", { name: "One too many" } as any, actor), code("EVENT_TYPE_LIMIT"));
        await new UpdateEventTypeUseCase(w.deps).execute("s1", last.id, { isActive: false }, actor);
        await assert.rejects(uc.execute("s1", { name: "Still too many" } as any, actor), code("EVENT_TYPE_LIMIT"));
        await new DeleteEventTypeUseCase(w.deps).execute("s1", last.id, actor);
        await uc.execute("s1", { name: "Now fits" } as any, actor);
    });
    it("create: two admins at the same moment cannot both take the last slot", async () => {
        const w = world(MAX_CUSTOM_EVENT_TYPES - 1); const uc = new CreateEventTypeUseCase(w.deps);
        const results = await Promise.allSettled([uc.execute("s1", { name: "Alpha" } as any, actor), uc.execute("s1", { name: "Beta" } as any, actor), uc.execute("s1", { name: "Gamma" } as any, actor)]);
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        assert.equal(w.customCount(), MAX_CUSTOM_EVENT_TYPES);
        for (const r of results.filter(r => r.status === "rejected") as PromiseRejectedResult[]) assert.equal(r.reason.code, "EVENT_TYPE_LIMIT");
    });
    it("update: rename, recolour, deactivate and reactivate a custom type; the key never changes; each audited", async () => {
        const w = world(); const t = await new CreateEventTypeUseCase(w.deps).execute("s1", { name: "Quiz" } as any, actor);
        const up = new UpdateEventTypeUseCase(w.deps);
        const r = await up.execute("s1", t.id, { name: "Quiz Day", color: "#000000", icon: "star" }, actor);
        assert.deepEqual({ key: r.key, name: r.name, color: r.color }, { key: "quiz", name: "Quiz Day", color: "#000000" });
        assert.equal((await up.execute("s1", t.id, { isActive: false }, actor)).isActive, false);
        assert.equal((await up.execute("s1", t.id, { isActive: true }, actor)).isActive, true);
        assert.deepEqual(w.audits.map(a => a.action), ["event_type.created", "event_type.updated", "event_type.deactivated", "event_type.activated"]);
    });
    it("update: renaming to a taken name is a 409; changing only the case of its own name is allowed; a no-op writes nothing", async () => {
        const w = world(); const create = new CreateEventTypeUseCase(w.deps); const up = new UpdateEventTypeUseCase(w.deps);
        const a = await create.execute("s1", { name: "Alpha" } as any, actor); await create.execute("s1", { name: "Beta" } as any, actor);
        await assert.rejects(up.execute("s1", a.id, { name: "beta" }, actor), code("EVENT_TYPE_NAME_TAKEN"));
        assert.equal((await up.execute("s1", a.id, { name: "ALPHA" }, actor)).name, "ALPHA");
        const audits = w.audits.length; await up.execute("s1", a.id, { name: "ALPHA" }, actor);
        assert.equal(w.audits.length, audits);
    });
    it("update: a system type takes colour and icon, but never a new name or a deactivation; unknown id is 404", async () => {
        const w = world(); const up = new UpdateEventTypeUseCase(w.deps); const exam = SYSTEM_EVENT_TYPES.find(t => t.key === "exam")!;
        assert.equal((await up.execute("s1", exam.id, { color: "#FF0000" }, actor)).color, "#FF0000");
        await assert.rejects(up.execute("s1", exam.id, { name: "Tests" }, actor), code("EVENT_TYPE_PROTECTED"));
        await assert.rejects(up.execute("s1", exam.id, { isActive: false }, actor), code("EVENT_TYPE_PROTECTED"));
        await assert.rejects(up.execute("s1", "nope", { color: "#000000" }, actor), { statusCode: 404 });
    });
    it("delete: unused custom type goes; used one is refused with the count; system one is refused", async () => {
        const w = world(); const t = await new CreateEventTypeUseCase(w.deps).execute("s1", { name: "Quiz" } as any, actor);
        const del = new DeleteEventTypeUseCase(w.deps);
        w.events.set(t.id, 4);
        await assert.rejects(del.execute("s1", t.id, actor), (e: any) => e.code === "EVENT_TYPE_IN_USE" && e.details?.events === 4);
        assert.ok(w.rows.has(t.id));
        w.events.set(t.id, 0);
        await del.execute("s1", t.id, actor); assert.ok(!w.rows.has(t.id)); assert.equal(w.audits.at(-1).action, "event_type.deleted");
        await assert.rejects(del.execute("s1", SYSTEM_EVENT_TYPES[0].id, actor), code("EVENT_TYPE_PROTECTED"));
        await assert.rejects(del.execute("s1", "nope", actor), { statusCode: 404 });
    });
    it("list: active types for everyone; inactive only with events.types.manage (403 otherwise)", async () => {
        const w = world(); const t = await new CreateEventTypeUseCase(w.deps).execute("s1", { name: "Quiz" } as any, actor);
        await new UpdateEventTypeUseCase(w.deps).execute("s1", t.id, { isActive: false }, actor);
        const list = new ListEventTypesUseCase(w.deps);
        const admin: any = { can: (k: string) => k === "events.types.manage" }; const staff: any = { can: () => false };
        assert.equal((await list.execute({ includeInactive: false }, staff)).length, 11);
        assert.equal((await list.execute({ includeInactive: true }, admin)).length, 12);
        await assert.rejects(list.execute({ includeInactive: true }, staff), { statusCode: 403 });
        await assert.rejects(list.execute({ includeInactive: true }, undefined), { statusCode: 403 });
    });
});

describe("event type routes and wiring (static)", () => {
    const src = (p: string) => readFileSync(join(__dirname, "../../src/modules/events", p), "utf8");
    const routes = src("routes/event.routes.ts");
    it("/types routes are declared before /:id, so 'types' is never read as an event id", () => {
        const first = routes.indexOf('router.get("/types"');
        assert.ok(first > 0);
        for (const m of ['router.get("/:id"', 'router.patch("/:id"', 'router.delete("/:id"']) assert.ok(first < routes.indexOf(m), m);
    });
    it("writes need events.types.manage; reading active types needs only a signed-in school person", () => {
        assert.match(routes, /const manageTypes = \[authenticate, requireTenant, requirePermission\("events\.types\.manage"\)\]/);
        for (const line of routes.split("\n").filter(l => /router\.(post|patch|delete)\("\/types/.test(l))) assert.match(line, /\.\.\.manageTypes/);
        assert.match(routes, /router\.get\("\/types", \.\.\.viewer/);
    });
    it("bodies are validated by the strict DTOs, and the DTOs accept no key, id or isSystem", () => {
        assert.match(routes, /validate\(CreateEventTypeDto\)/); assert.match(routes, /validate\(UpdateEventTypeDto\)/);
        const dto = src("dtos/event-type.dto.ts").replace(/\/\*[\s\S]*?\*\//g, "");
        assert.equal((dto.match(/\.strict\(\)/g) ?? []).length, 3);
        assert.doesNotMatch(dto, /[{,]\s*(key|isSystem|id)\s*:/);
    });
    it("the tenant comes from the request, never from the body or query: the controller takes school and actor from the session only", () => {
        const c = src("controllers/event-type.controller.ts");
        assert.match(c, /req\.schoolId/); assert.match(c, /req\.auth/); assert.doesNotMatch(c, /req\.(body|query)\.(schoolId|userId)/);
    });
    it("the container registers the module", () => {
        const c = src("events.container.ts");
        for (const n of ["eventTypeRepository", "eventTypeController", "listEventTypesUseCase", "createEventTypeUseCase", "updateEventTypeUseCase", "deleteEventTypeUseCase"]) assert.match(c, new RegExp(n + ":"));
    });
    it("the create use case takes the lock, counts and inserts in one transaction (the order matters)", () => {
        const u = src("usecases/event-types.usecases.ts");
        const body = u.slice(u.indexOf("class CreateEventTypeUseCase"), u.indexOf("class UpdateEventTypeUseCase"));
        const [lock, count, create] = ["lockForCreate()", "countCustom()", "repo.create("].map(x => body.indexOf(x));
        assert.ok(lock > 0 && lock < count && count < create);
    });
});
