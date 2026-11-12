import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { assertAudience, assertSchedule, normaliseKinds, normaliseReminderOffsets, scheduleChanged } from "../../src/modules/events/domain/event.policy";
import { audienceScope, canActOnEvent } from "../../src/modules/events/domain/event.scope";
import { EventViewerService } from "../../src/modules/events/services/event-viewer.service";
import { EventMapper } from "../../src/modules/events/mappers/event.mapper";
import { CreateEventUseCase, UpdateEventUseCase, DeleteEventUseCase, CancelEventUseCase, ListEventsUseCase, GetEventUseCase } from "../../src/modules/events/usecases/events.usecases";
import { DeleteCalendarEventUseCase, UpdateCalendarEventUseCase, ListCalendarEventsUseCase } from "../../src/modules/events/usecases/legacy-calendar.usecases";

const d = (s: string) => new Date(s);
const code = (c: string) => ({ code: c });
const access = (can: string[], scope: "ALL" | string[]): any => ({ can: (k: string) => can.includes(k), scopeOf: () => (scope === "ALL" ? "ALL" : "BRANCH"), branchScope: () => scope });

describe("event permissions and role templates", () => {
    it("registry stays valid; events.manage / events.publish exist once; publish is sensitive", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        for (const k of ["events.manage", "events.publish"]) assert.equal(PERMISSION_REGISTRY.filter(p => p.key === k).length, 1);
        assert.equal(PERMISSION_REGISTRY.find(p => p.key === "events.publish")?.isSensitive, true);
    });
    it("only principal and branch_principal gained permissions, exactly the agreed ones; every other grant is unchanged", () => {
        const base = JSON.parse(readFileSync(join(__dirname, "role-templates.baseline.json"), "utf8")) as { templates: Record<string, string[]> };
        const added: Record<string, string[]> = {};
        for (const t of ROLE_TEMPLATES) {
            const now = t.permissions.map(p => `${p.key}:${p.scope}`).sort();
            const was = base.templates[t.key];
            assert.ok(was, `${t.key} is new`);
            assert.deepEqual(was.filter(x => !now.includes(x)), [], `${t.key} lost permissions`);
            added[t.key] = now.filter(x => !was.includes(x));
        }
        assert.deepEqual(Object.keys(base.templates).sort(), ROLE_TEMPLATES.map(t => t.key).sort());
        assert.deepEqual(added.principal, ["events.manage:ALL", "events.publish:ALL"]);
        assert.deepEqual(added.branch_principal, ["events.manage:BRANCH"]);
        for (const k of Object.keys(added).filter(k => k !== "principal" && k !== "branch_principal")) assert.deepEqual(added[k], [], `${k} changed`);
    });
});

describe("event policy", () => {
    const day = { startDate: d("2026-12-01"), endDate: null };
    it("schedule: all-day has no times; timed needs a start; same-day end must be later", () => {
        assertSchedule({ ...day, isAllDay: true, startTime: null, endTime: null });
        assert.throws(() => assertSchedule({ ...day, isAllDay: true, startTime: "09:00", endTime: null }), code("EVENT_TIME_ON_ALL_DAY"));
        assert.throws(() => assertSchedule({ ...day, isAllDay: false, startTime: null, endTime: null }), code("EVENT_TIME_REQUIRED"));
        assert.throws(() => assertSchedule({ ...day, isAllDay: false, startTime: "10:00", endTime: "09:00" }), code("EVENT_END_TIME_BEFORE_START"));
        assertSchedule({ startDate: d("2026-12-01"), endDate: d("2026-12-02"), isAllDay: false, startTime: "18:00", endTime: "09:00" });   // overnight, different day
        assert.throws(() => assertSchedule({ startDate: d("2026-12-02"), endDate: d("2026-12-01"), isAllDay: true, startTime: null, endTime: null }), code("END_BEFORE_START"));
    });
    it("reschedule detection looks at date and time, not at other fields", () => {
        const a = { ...day, isAllDay: false, startTime: "09:00", endTime: null };
        assert.equal(scheduleChanged(a, { ...a }), false);
        assert.equal(scheduleChanged(a, { ...a, startTime: "10:00" }), true);
        assert.equal(scheduleChanged(a, { ...a, startDate: d("2026-12-02") }), true);
    });
    it("audience: EVERYONE stands alone; classes refused with staff; a holiday is school-wide", () => {
        assert.deepEqual(normaliseKinds(["STUDENTS", "EVERYONE", "STUDENTS"]), ["EVERYONE"]);
        assert.deepEqual(normaliseKinds(["STUDENTS", "STUDENTS", "GUARDIANS"]), ["STUDENTS", "GUARDIANS"]);
        assert.throws(() => assertAudience({ audienceKinds: ["EVERYONE"], branchIds: [], classIds: ["c"], isHoliday: false }), code("EVENT_CLASS_AUDIENCE_NOT_FOR_STAFF"));
        assertAudience({ audienceKinds: ["STUDENTS", "GUARDIANS"], branchIds: [], classIds: ["c"], isHoliday: false });
        assert.throws(() => assertAudience({ audienceKinds: ["STUDENTS"], branchIds: [], classIds: [], isHoliday: true }), code("EVENT_HOLIDAY_NOT_SCHOOL_WIDE"));
        assert.throws(() => assertAudience({ audienceKinds: ["EVERYONE"], branchIds: ["b"], classIds: [], isHoliday: true }), code("EVENT_HOLIDAY_NOT_SCHOOL_WIDE"));
    });
    it("reminders: unique, sorted largest first, 5 minutes to 90 days, at most 5", () => {
        assert.deepEqual(normaliseReminderOffsets([60, 1440, 60]), [1440, 60]);
        assert.throws(() => normaliseReminderOffsets([4]), code("EVENT_BAD_REMINDERS"));
        assert.throws(() => normaliseReminderOffsets([90 * 1440 + 1]), code("EVENT_BAD_REMINDERS"));
        assert.throws(() => normaliseReminderOffsets([5, 10, 15, 20, 25, 30]), code("EVENT_BAD_REMINDERS"));
    });
});

describe("event scope", () => {
    it("BRANCH scope acts only on events aimed wholly at own branches; ALL acts on any", () => {
        assert.equal(canActOnEvent(access(["events.manage"], "ALL"), "events.manage", { branchIds: [] }), true);
        const b = access(["events.manage"], ["b1"]);
        assert.equal(canActOnEvent(b, "events.manage", { branchIds: [] }), false);
        assert.equal(canActOnEvent(b, "events.manage", { branchIds: ["b1"] }), true);
        assert.equal(canActOnEvent(b, "events.manage", { branchIds: ["b1", "b2"] }), false);
        assert.equal(canActOnEvent(access([], []), "events.manage", { branchIds: ["b1"] }), false);
    });
    it("a branch manager's new event defaults to their branches and refuses others", () => {
        const b = access(["events.manage"], ["b1"]);
        assert.deepEqual(audienceScope(b, "events.manage", { audienceKinds: ["EVERYONE"] }, new Map()).branchIds, ["b1"]);
        assert.throws(() => audienceScope(b, "events.manage", { audienceKinds: ["EVERYONE"], branchIds: ["b2"] }, new Map()), { code: "EVENT_OUT_OF_SCOPE" });
        assert.deepEqual(audienceScope(access(["events.manage"], "ALL"), "events.manage", { audienceKinds: ["STUDENTS"] }, new Map()).branchIds, []);
    });
});

// ── use cases on an in-memory repository ─────────────────────────────────────
const SID = "11111111-1111-4111-8111-111111111111", TID = "22222222-2222-4222-8222-222222222222", C1 = "c1", B1 = "b1", B2 = "b2";
function world(seed: any[] = []) {
    const rows = new Map<string, any>(seed.map(r => [r.id, r]));
    let n = 0; const audits: any[] = [];
    const base = (id: string, o: any) => ({ id, termId: null, sessionId: null, description: null, endDate: null, type: "event", isHoliday: false, createdById: "u1", createdAt: d("2026-01-01"), updatedAt: d("2026-01-01"), status: "PUBLISHED", isAllDay: true, startTime: null, endTime: null, location: null, coverImageUrl: null, audienceKinds: ["EVERYONE"], branchIds: [], classIds: [], notifyChannels: [], reminderOffsetsMinutes: [], revision: 1, publishedAt: null, publishedById: null, publishNoticeSentAt: null, cancelledAt: null, cancelledById: null, cancelReason: null, updatedById: null, ...o });
    const eventRepository: any = {
        create: async ({ data, branchIds = [], classIds = [] }: any) => { const id = `e${++n}`; const r = base(id, { ...data, branchIds, classIds }); rows.set(id, r); return r; },
        findById: async (id: string) => rows.get(id) ?? null,
        findMany: async (where: any) => [...rows.values()].filter(r => !where.status || (where.status.in ? where.status.in.includes(r.status) : where.status === r.status)),
        update: async (id: string, { data, branchIds, classIds }: any) => { const r = { ...rows.get(id), ...data, ...(branchIds ? { branchIds } : {}), ...(classIds ? { classIds } : {}) }; rows.set(id, r); return r; },
        deleteDraft: async (id: string) => { rows.delete(id); },
    };
    const session: any = { id: SID, name: "2026/2027", terms: [{ id: TID, name: "first", sessionId: SID }] };
    const sessionRepository: any = { findAllSessions: async () => [session], findSessionById: async (id: string) => (id === SID ? session : null), findTermById: async (id: string) => (id === TID ? session.terms[0] : null) };
    const branchRepository: any = { findMany: async (w: any) => [B1, B2].filter(b => w.id.in.includes(b)).map(id => ({ id })) };
    const classRepository: any = { findAllClasses: async () => [{ id: C1, branchId: B1 }] };
    const auditService: any = { log: async (p: any) => { audits.push(p); } };
    const deps: any = { eventRepository, sessionRepository, branchRepository, classRepository, eventMapper: new EventMapper(), auditService };
    const persona = (r: any[]) => ({ findMany: async () => r });
    deps.eventViewerService = new EventViewerService({ studentRepository: persona([]) as any, guardianRepository: persona([]) as any, staffRepository: persona([]) as any });
    deps.cancelEventUseCase = new CancelEventUseCase(deps);
    return { rows, audits, deps, base };
}
const actor = { userId: "u1" };
const all = access(["events.manage", "events.publish"], "ALL");
const dto = (o: any = {}) => ({ title: "Sports day", type: "sports", startDate: "2026-12-01", isAllDay: true, audienceKinds: ["EVERYONE"], notifyChannels: ["IN_APP"], reminderOffsetsMinutes: [], ...o });

describe("event use cases", () => {
    it("create always makes a DRAFT, derives the session from the term, audits, answers with names and audience", async () => {
        const w = world();
        const out = await new CreateEventUseCase(w.deps).execute("s", dto({ termId: TID, reminderOffsetsMinutes: [60, 1440] }) as any, actor, all);
        assert.equal(out.status, "DRAFT"); assert.equal(w.rows.get(out.id).sessionId, SID); assert.equal(w.rows.get(out.id).publishedAt, null);
        assert.deepEqual(out.session, { id: SID, name: "2026/2027" }); assert.deepEqual(out.reminderOffsetsMinutes, [1440, 60]);
        assert.deepEqual(out.audience, { kinds: ["EVERYONE"], branchIds: [], classIds: [] });
        assert.equal(w.audits[0].action, "calendar_event.created");
    });
    it("create validates term/session, branches, classes and schedule", async () => {
        const w = world(); const run = (o: any, a: any = all) => new CreateEventUseCase(w.deps).execute("s", dto(o) as any, actor, a);
        await assert.rejects(run({ termId: "44444444-4444-4444-8444-444444444444" }), { code: "NOT_FOUND" });
        await assert.rejects(run({ termId: TID, sessionId: "33333333-3333-4333-8333-333333333333" }), code("EVENT_SCOPE_MISMATCH"));
        await assert.rejects(run({ branchIds: ["nope"] }), code("EVENT_BRANCH_NOT_FOUND"));
        await assert.rejects(run({ audienceKinds: ["STUDENTS"], classIds: ["nope"] }), code("EVENT_CLASS_NOT_FOUND"));
        await assert.rejects(run({ audienceKinds: ["STUDENTS"], classIds: [C1], branchIds: [B2] }), code("EVENT_CLASS_OUTSIDE_BRANCHES"));
        await assert.rejects(run({ audienceKinds: ["EVERYONE"], classIds: [C1] }), code("EVENT_CLASS_AUDIENCE_NOT_FOR_STAFF"));
        await assert.rejects(run({ isAllDay: false }), code("EVENT_TIME_REQUIRED"));
        await assert.rejects(run({ type: "holiday", audienceKinds: ["STUDENTS"] }), code("EVENT_HOLIDAY_NOT_SCHOOL_WIDE"));
        assert.equal(w.rows.size, 0);
    });
    it("a branch manager's event is limited to their branch and cannot target another", async () => {
        const w = world(); const b1 = access(["events.manage"], [B1]);
        const out = await new CreateEventUseCase(w.deps).execute("s", dto() as any, actor, b1);
        assert.deepEqual(out.audience.branchIds, [B1]);
        await assert.rejects(new CreateEventUseCase(w.deps).execute("s", dto({ branchIds: [B2] }) as any, actor, b1), { code: "EVENT_OUT_OF_SCOPE" });
    });
    it("update: only changed fields are saved; a published event's audience is locked; a published event's date moves only through reschedule", async () => {
        const w = world(); w.rows.set("p", w.base("p", { title: "Fair", status: "PUBLISHED", startDate: d("2026-12-01") }));
        const up = new UpdateEventUseCase(w.deps);
        await up.execute("s", "p", { title: "Fair" } as any, actor, all);
        assert.equal(w.audits.length, 0);
        await assert.rejects(up.execute("s", "p", { audienceKinds: ["STUDENTS"] } as any, actor, all), code("EVENT_AUDIENCE_LOCKED"));
        await up.execute("s", "p", { audienceKinds: ["EVERYONE"] } as any, actor, all);             // same audience is fine
        await assert.rejects(up.execute("s", "p", { startDate: "2026-12-05" } as any, actor, all), code("EVENT_USE_RESCHEDULE"));
        await up.execute("s", "p", { location: "Field" } as any, actor, all);
        assert.equal(w.rows.get("p").revision, 1); assert.equal(w.audits.at(-1).action, "calendar_event.updated");
    });
    it("update: drafts may change audience; switching to all-day clears times; cancelled is frozen; out-of-scope is refused", async () => {
        const w = world(); w.rows.set("dr", w.base("dr", { status: "DRAFT", isAllDay: false, startTime: "09:00", startDate: d("2026-12-01") }));
        const up = new UpdateEventUseCase(w.deps);
        const o = await up.execute("s", "dr", { audienceKinds: ["STUDENTS"], branchIds: [B1], isAllDay: true } as any, actor, all);
        assert.deepEqual(o.audience, { kinds: ["STUDENTS"], branchIds: [B1], classIds: [] }); assert.equal(o.isAllDay, true); assert.equal(o.startTime, null); assert.equal(o.revision, 1);
        w.rows.set("x", w.base("x", { status: "CANCELLED" }));
        await assert.rejects(up.execute("s", "x", { title: "n" } as any, actor, all), code("EVENT_CANCELLED"));
        await assert.rejects(up.execute("s", "dr", { title: "n" } as any, actor, access(["events.manage"], [B2])), { code: "EVENT_OUT_OF_SCOPE" });
        await assert.rejects(up.execute("s", "nope", { title: "n" } as any, actor, all), { code: "NOT_FOUND" });
    });
    it("delete: drafts only; a published or cancelled event is never erased", async () => {
        const w = world(); w.rows.set("dr", w.base("dr", { status: "DRAFT" })); w.rows.set("pu", w.base("pu", {})); w.rows.set("ca", w.base("ca", { status: "CANCELLED" }));
        const del = new DeleteEventUseCase(w.deps);
        await assert.rejects(del.execute("s", "pu", actor, all), code("EVENT_NOT_DRAFT"));
        await assert.rejects(del.execute("s", "ca", actor, all), code("EVENT_NOT_DRAFT"));
        await del.execute("s", "dr", actor, all);
        assert.deepEqual([...w.rows.keys()].sort(), ["ca", "pu"]); assert.equal(w.audits.at(-1).action, "calendar_event.deleted");
    });
    it("cancel: published → cancelled once (idempotent), a draft cannot be cancelled", async () => {
        const w = world(); w.rows.set("pu", w.base("pu", {})); w.rows.set("dr", w.base("dr", { status: "DRAFT" }));
        const c = new CancelEventUseCase(w.deps);
        const first = await c.execute("s", "pu", actor, { reason: "Rain", access: all });
        assert.equal(first.changed, true); assert.equal(first.event.status, "CANCELLED"); assert.equal(w.rows.get("pu").cancelReason, "Rain");
        assert.equal((await c.execute("s", "pu", actor, { access: all })).changed, false);
        assert.equal(w.audits.filter(a => a.action === "calendar_event.cancelled").length, 1);
        await assert.rejects(c.execute("s", "dr", actor, { access: all }), code("EVENT_NOT_PUBLISHED"));
    });
    it("viewing: managers see drafts; everyone else sees only published/cancelled whole-school events; a hidden event is a 404", async () => {
        const w = world(); const viewer = { ...access([], "ALL"), persona: "STAFF", personaEntityId: "t1" };
        w.rows.set("dr", w.base("dr", { status: "DRAFT" })); w.rows.set("pu", w.base("pu", {})); w.rows.set("ca", w.base("ca", { status: "CANCELLED" }));
        w.rows.set("st", w.base("st", { audienceKinds: ["STUDENTS"] })); w.rows.set("br", w.base("br", { branchIds: [B1] }));
        const list = new ListEventsUseCase(w.deps);
        assert.deepEqual((await list.execute({} as any, viewer)).map(e => e.id).sort(), ["ca", "pu"]);
        assert.deepEqual((await list.execute({ status: "DRAFT" } as any, viewer)).map(e => e.id).sort(), ["ca", "pu"]);   // the status filter is for managers only
        assert.equal((await list.execute({} as any, all)).length, 5);
        const get = new GetEventUseCase(w.deps);
        await assert.rejects(get.execute("dr", viewer), { code: "NOT_FOUND" });
        await assert.rejects(get.execute("st", viewer), { code: "NOT_FOUND" });
        assert.equal((await get.execute("dr", all)).status, "DRAFT");
    });
});

describe("legacy calendar routes keep their behaviour", () => {
    it("legacy response has exactly the old fields", async () => {
        const w = world(); w.rows.set("pu", w.base("pu", { title: "Break", type: "break", startDate: d("2026-12-01") }));
        const [e] = await new ListCalendarEventsUseCase(w.deps).execute({} as any);
        assert.deepEqual(Object.keys(e).sort(), ["createdAt", "description", "endDate", "id", "isHoliday", "session", "startDate", "term", "title", "type"]);
    });
    it("list shows published only; update treats draft and cancelled as not found", async () => {
        const w = world(); w.rows.set("dr", w.base("dr", { status: "DRAFT" })); w.rows.set("ca", w.base("ca", { status: "CANCELLED" })); w.rows.set("pu", w.base("pu", {}));
        assert.deepEqual((await new ListCalendarEventsUseCase(w.deps).execute({} as any)).map(e => e.id), ["pu"]);
        const up = new UpdateCalendarEventUseCase(w.deps);
        await assert.rejects(up.execute("s", "dr", { title: "x" } as any, actor), { code: "NOT_FOUND" });
        await assert.rejects(up.execute("s", "ca", { title: "x" } as any, actor), { code: "NOT_FOUND" });
    });
    it("delete: draft = erased; published = cancelled with extra fields and title unchanged; again = same answer; unknown = 404", async () => {
        const w = world(); w.rows.set("dr", w.base("dr", { status: "DRAFT", title: "D" })); w.rows.set("pu", w.base("pu", { title: "P" }));
        const del = new DeleteCalendarEventUseCase(w.deps);
        assert.deepEqual(await del.execute("s", "dr", actor), { deleted: true, title: "D" }); assert.equal(w.rows.has("dr"), false);
        assert.equal(w.audits.at(-1).action, "calendar_event.deleted");
        const out = await del.execute("s", "pu", actor);
        assert.deepEqual(out, { deleted: true, title: "P", cancelled: true, status: "CANCELLED" });
        assert.equal(w.rows.get("pu").status, "CANCELLED");
        const cancelAudit = w.audits.filter(a => a.action === "calendar_event.cancelled");
        assert.equal(cancelAudit.length, 1); assert.equal(cancelAudit[0].newValue.via, "legacy_delete");
        assert.deepEqual(await del.execute("s", "pu", actor), out);
        assert.equal(w.audits.filter(a => a.action === "calendar_event.cancelled").length, 1);
        await assert.rejects(del.execute("s", "nope", actor), { code: "NOT_FOUND" });
    });
});

describe("events source rules", () => {
    const root = join(process.cwd(), "src", "modules");
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
    it("the sessions module no longer carries calendar code, and attendance reads only published holidays", () => {
        assert.deepEqual(files(join(root, "sessions")).filter(f => /calendar/i.test(f)), []);
        assert.match(readFileSync(join(root, "attendance", "repositories", "attendance.repository.ts"), "utf8"), /isHoliday: true, status: "PUBLISHED"/);
    });
    it("the events module never reaches the database client directly", () => {
        const bad = files(join(root, "events")).filter(f => /usecases|controllers/.test(f) && /prisma\.client/.test(readFileSync(f, "utf8")));
        assert.deepEqual(bad, []);
    });
});
