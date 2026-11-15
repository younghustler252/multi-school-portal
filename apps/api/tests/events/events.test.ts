import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { ROLE_REVOCATIONS } from "../../src/foundation/role-revocations.registry";
import { assertAudience, assertSchedule, normaliseKinds, normaliseReminderOffsets, scheduleChanged } from "../../src/modules/events/domain/event.policy";
import { audienceScope, canActOnEvent } from "../../src/modules/events/domain/event.scope";
import { EventViewerService } from "../../src/modules/events/services/event-viewer.service";
import { EventMapper } from "../../src/modules/events/mappers/event.mapper";
import { CreateEventUseCase, UpdateEventUseCase, DeleteEventUseCase, CancelEventUseCase, ListEventsUseCase, GetEventUseCase } from "../../src/modules/events/usecases/events.usecases";
import { applyType, typeRepository, QUIZ_ID, OLD_ID } from "./fake-types";
import { HOLIDAY_TYPE_ID } from "../../src/modules/events/domain/event-type.catalog";
import { CreateCalendarEventUseCase } from "../../src/modules/events/usecases/legacy-calendar.usecases";
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
        // The baseline is from before the events work. Later, deliberate changes are allowed ONLY if they are on record:
        // a permission may be missing only if a revocation names it, and the one known later addition is listed here.
        const revoked = (templateKey: string) => new Set(ROLE_REVOCATIONS.filter(r => r.templateKey === templateKey).flatMap(r => r.permissions));
        const laterAdditions: Record<string, string[]> = { bursar: ["students.lookup:ALL", "school.dashboard.counts:ALL"] };
        const added: Record<string, string[]> = {};
        for (const t of ROLE_TEMPLATES) {
            const now = t.permissions.map(p => `${p.key}:${p.scope}`).sort();
            const was = base.templates[t.key];
            assert.ok(was, `${t.key} is new`);
            assert.deepEqual(was.filter(x => !now.includes(x) && !revoked(t.key).has(x.split(":")[0])), [], `${t.key} lost permissions that no revocation names`);
            added[t.key] = now.filter(x => !was.includes(x) && !(laterAdditions[t.key] ?? []).includes(x));
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
    const rows = new Map<string, any>(seed.map(r => [r.id, applyType(r)]));
    let n = 0; const audits: any[] = [];
    const base = (id: string, o: any) => ({ id, termId: null, sessionId: null, description: null, endDate: null, type: "event", isHoliday: false, createdById: "u1", createdAt: d("2026-01-01"), updatedAt: d("2026-01-01"), status: "PUBLISHED", isAllDay: true, startTime: null, endTime: null, location: null, coverImageUrl: null, audienceKinds: ["EVERYONE"], branchIds: [], classIds: [], notifyChannels: [], reminderOffsetsMinutes: [], revision: 1, publishedAt: null, publishedById: null, publishNoticeSentAt: null, cancelledAt: null, cancelledById: null, cancelReason: null, updatedById: null, ...o });
    const eventRepository: any = {
        create: async ({ data, branchIds = [], classIds = [] }: any) => { const id = `e${++n}`; const r = applyType(base(id, { ...data, branchIds, classIds })); rows.set(id, r); return r; },
        findById: async (id: string) => rows.get(id) ?? null,
        findMany: async (where: any) => [...rows.values()].filter(r => !where.status || (where.status.in ? where.status.in.includes(r.status) : where.status === r.status)),
        update: async (id: string, { data, branchIds, classIds }: any) => { const r = applyType({ ...rows.get(id), ...data, ...(branchIds ? { branchIds } : {}), ...(classIds ? { classIds } : {}) }); rows.set(id, r); return r; },
        listRemindersFor: async () => [],
        deleteDraft: async (id: string) => { rows.delete(id); },
    };
    const session: any = { id: SID, name: "2026/2027", terms: [{ id: TID, name: "first", sessionId: SID }] };
    const sessionRepository: any = { findAllSessions: async () => [session], findSessionById: async (id: string) => (id === SID ? session : null), findTermById: async (id: string) => (id === TID ? session.terms[0] : null) };
    const branchRepository: any = { findMany: async (w: any) => [B1, B2].filter(b => w.id.in.includes(b)).map(id => ({ id })) };
    const classRepository: any = { findAllClasses: async () => [{ id: C1, branchId: B1 }] };
    const auditService: any = { log: async (p: any) => { audits.push(p); } };
    const deps: any = { eventRepository, eventTypeRepository: typeRepository(), sessionRepository, branchRepository, classRepository, eventMapper: new EventMapper(), auditService };
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

describe("events with school-managed types (stage E3)", () => {
    const create = (w: any, o: any = {}) => new CreateEventUseCase(w.deps).execute("s", dto(o) as any, actor, all);
    const viewer: any = { ...access([], "ALL"), persona: "STAFF", personaEntityId: "t1" };

    it("a custom type by key: the response has type = its key and the full eventType; it is not a holiday", async () => {
        const w = world(); const out: any = await create(w, { type: "quiz" });
        assert.equal(out.type, "quiz"); assert.equal(out.isHoliday, false);
        assert.deepEqual(out.eventType, { id: QUIZ_ID, key: "quiz", name: "Quiz", color: "#123456", icon: "star", isSystem: false, isActive: true });
        assert.equal(w.rows.get(out.id).eventTypeId, QUIZ_ID);
        assert.equal(w.rows.get(out.id).type, "other");                         // the enum mirror
        assert.equal(w.audits[0].newValue.type, "quiz");
    });
    it("a type by id works, no type means \"event\", and an unknown or inactive type is refused", async () => {
        const w = world();
        assert.equal(((await create(w, { type: undefined, eventTypeId: QUIZ_ID })) as any).type, "quiz");
        assert.equal(((await create(w, { type: undefined })) as any).type, "event");
        await assert.rejects(create(w, { type: "nope" }), code("EVENT_TYPE_UNKNOWN"));
        await assert.rejects(create(w, { type: undefined, eventTypeId: "00000000-0000-4000-8000-0000000000ff" }), code("EVENT_TYPE_UNKNOWN"));
        await assert.rejects(create(w, { type: "old-type" }), code("EVENT_TYPE_INACTIVE"));
    });
    it("holiday is decided by the system holiday type only: it must be school-wide; a custom type never makes a holiday", async () => {
        const w = world();
        const h: any = await create(w, { type: "holiday" });
        assert.equal(h.isHoliday, true); assert.equal(h.eventType.id, HOLIDAY_TYPE_ID);
        await assert.rejects(create(w, { type: "holiday", audienceKinds: ["STUDENTS"] }), code("EVENT_HOLIDAY_NOT_SCHOOL_WIDE"));
        assert.equal(((await create(w, { type: "quiz", audienceKinds: ["STUDENTS"] })) as any).isHoliday, false);
    });
    it("update: a draft can change type (both ways); a published event cannot enter or leave the holiday type, but can move between other types", async () => {
        const w = world(); const up = new UpdateEventUseCase(w.deps);
        const draft: any = await create(w, { type: "event" });
        assert.equal(((await up.execute("s", draft.id, { type: "holiday" } as any, actor, all)) as any).isHoliday, true);
        assert.equal(((await up.execute("s", draft.id, { type: "quiz" } as any, actor, all)) as any).isHoliday, false);
        const pub = w.base("p1", { startDate: d("2026-12-01"), status: "PUBLISHED", type: "exam", publishedAt: d("2026-01-01") }); w.rows.set("p1", applyType(pub));
        await assert.rejects(up.execute("s", "p1", { type: "holiday" } as any, actor, all), code("EVENT_HOLIDAY_TYPE_LOCKED"));
        assert.equal(((await up.execute("s", "p1", { type: "quiz" } as any, actor, all)) as any).type, "quiz");
        w.rows.set("p2", applyType(w.base("p2", { startDate: d("2026-12-01"), status: "PUBLISHED", type: "holiday" })));
        await assert.rejects(up.execute("s", "p2", { type: "exam" } as any, actor, all), code("EVENT_HOLIDAY_TYPE_LOCKED"));
        assert.equal(((await up.execute("s", "p2", { type: "holiday", title: "Renamed" } as any, actor, all)) as any).title, "Renamed");      // same type is not a change
    });
    it("update: an event keeps an inactive type it already has, but cannot be moved to an inactive one", async () => {
        const w = world(); const up = new UpdateEventUseCase(w.deps);
        w.rows.set("o1", applyType(w.base("o1", { startDate: d("2026-12-01"), status: "DRAFT", eventTypeId: OLD_ID })));
        const out: any = await up.execute("s", "o1", { title: "Still fine", type: "old-type" } as any, actor, all);
        assert.equal(out.eventType.key, "old-type"); assert.equal(out.eventType.isActive, false);
        w.rows.set("o2", applyType(w.base("o2", { startDate: d("2026-12-01"), status: "DRAFT", type: "exam" })));
        await assert.rejects(up.execute("s", "o2", { type: "old-type" } as any, actor, all), code("EVENT_TYPE_INACTIVE"));
    });
    it("list filters by type key or by type id", async () => {
        const w = world(); const seen: any[] = []; const find = w.deps.eventRepository.findMany;
        w.deps.eventRepository.findMany = async (where: any) => { seen.push(where); return find(where); };
        const list = new ListEventsUseCase(w.deps);
        await list.execute({ type: "quiz" } as any, all); await list.execute({ eventTypeId: QUIZ_ID } as any, all);
        assert.deepEqual(seen[0].eventType, { key: "quiz" }); assert.equal(seen[0].type, undefined);
        assert.equal(seen[1].eventTypeId, QUIZ_ID);
    });
    it("only managers get publishNoticeSentAt and the reminder summary (current revision only)", async () => {
        const w = world();
        w.rows.set("m1", applyType(w.base("m1", { startDate: d("2026-12-01"), status: "PUBLISHED", type: "exam", revision: 2, publishNoticeSentAt: d("2026-02-02") })));
        w.deps.eventRepository.listRemindersFor = async () => [
            { eventId: "m1", revision: 2, status: "SENT" }, { eventId: "m1", revision: 2, status: "PENDING" }, { eventId: "m1", revision: 2, status: "SKIPPED" },
            { eventId: "m1", revision: 1, status: "SENT" }, { eventId: "other", revision: 2, status: "SENT" }];
        const mgr: any = await new GetEventUseCase(w.deps).execute("m1", all);
        assert.deepEqual(mgr.reminders, { pending: 1, sent: 1, skipped: 1, failed: 0, cancelled: 0 });
        assert.equal(mgr.publishNoticeSentAt.toISOString(), d("2026-02-02").toISOString());
        const plain: any = await new GetEventUseCase(w.deps).execute("m1", viewer);
        assert.ok(!("reminders" in plain) && !("publishNoticeSentAt" in plain));
        assert.ok("type" in plain && "eventType" in plain && "isHoliday" in plain);
    });
    it("legacy routes: isHoliday: true with a non-holiday type is a 400; the old response shape is unchanged", async () => {
        const w = world(); const actorS: any = { userId: "u1" };
        const legacyCreate = new CreateCalendarEventUseCase(w.deps);
        await assert.rejects(legacyCreate.execute("s", { title: "x", type: "exam", startDate: "2026-12-01", isHoliday: true } as any, actorS), code("EVENT_HOLIDAY_REQUIRES_HOLIDAY_TYPE"));
        const ok: any = await legacyCreate.execute("s", { title: "Term break", type: "holiday", startDate: "2026-12-01", isHoliday: true } as any, actorS);
        assert.equal(ok.isHoliday, true);
        assert.deepEqual(Object.keys(ok).sort(), ["createdAt", "description", "endDate", "id", "isHoliday", "startDate", "term", "session", "title", "type"].sort());
        w.rows.set("L1", applyType(w.base("L1", { startDate: d("2026-12-01"), status: "PUBLISHED", type: "exam" })));
        await assert.rejects(new UpdateCalendarEventUseCase(w.deps).execute("s", "L1", { isHoliday: true } as any, actorS), code("EVENT_HOLIDAY_REQUIRES_HOLIDAY_TYPE"));
        w.rows.set("L2", applyType(w.base("L2", { startDate: d("2026-12-01"), status: "PUBLISHED", eventTypeId: QUIZ_ID })));
        assert.equal(((await new UpdateCalendarEventUseCase(w.deps).execute("s", "L2", { title: "Quiz night" } as any, actorS)) as any).type, "other");      // custom types look like "other" to the old routes
    });
    it("a database refusal for an inactive type (a deactivation that raced the write) answers like the normal check", () => {
        const { translateEventWriteError } = require("../../src/modules/events/repositories/event-write-errors");
        assert.throws(() => translateEventWriteError(new Error("EVENT_TYPE_INACTIVE: an inactive event type cannot be given to an event")), code("EVENT_TYPE_INACTIVE"));
        assert.throws(() => translateEventWriteError(new Error("EVENT_HOLIDAY_TYPE_LOCKED: x")), code("EVENT_HOLIDAY_TYPE_LOCKED"));
        assert.throws(() => translateEventWriteError(new Error("something else")), /something else/);
    });
    it("the new API no longer takes isHoliday, and the response still reports it (read-only)", () => {
        const dtoSrc = readFileSync(join(__dirname, "../../src/modules/events/dtos/event.dto.ts"), "utf8");
        assert.doesNotMatch(dtoSrc, /isHoliday/);
        assert.match(readFileSync(join(__dirname, "../../src/modules/events/mappers/event.mapper.ts"), "utf8"), /isHoliday: e\.isHoliday/);
    });
});
