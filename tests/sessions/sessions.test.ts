import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePermissionRegistry, PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { rangesOverlap, rangeInside, firstOverlap, isValidSessionName } from "../../src/modules/sessions/domain/session.policy";
import { CreateSessionDto, UpdateSessionDto, CreateTermDto, UpdateTermDto, SetCurrentTermDto } from "../../src/modules/sessions/dtos/session.dto";
import { CreateCalendarEventDto, UpdateCalendarEventDto, ListCalendarEventsQuery } from "../../src/modules/sessions/dtos/calendar.dto";
import { planTermAssignments } from "../../src/modules/classes/services/class-subject-plan";
import { planEnrolmentCarryForward, rolloverInTx } from "../../src/modules/sessions/services/term-rollover";
import { CreateSessionUseCase, UpdateSessionUseCase, CreateTermUseCase, UpdateTermUseCase } from "../../src/modules/sessions/usecases/session-commands.usecases";
import { CreateCalendarEventUseCase } from "../../src/modules/sessions/usecases/calendar.usecases";
import { SessionMapper, TermMapper } from "../../src/modules/sessions/mappers/session.mapper";
import { CalendarEventMapper } from "../../src/modules/sessions/mappers/calendar.mapper";

const d = (s: string) => new Date(s);
const r = (a: string, b: string) => ({ startDate: d(a), endDate: d(b) });
const SID = "11111111-1111-4111-8111-111111111111";
const TID = "22222222-2222-4222-8222-222222222222";

describe("session permissions and templates", () => {
    it("registry is valid; both keys exist once; every default role can view sessions", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        assert.equal(PERMISSION_REGISTRY.filter(p => p.key === "sessions.view").length, 1);
        assert.equal(PERMISSION_REGISTRY.find(p => p.key === "sessions.manage")?.isSensitive, true);
        for (const t of ROLE_TEMPLATES.filter(t => !t.grantsAll)) assert.ok(t.permissions.some(p => p.key === "sessions.view"), `${t.key} cannot view sessions`);
        for (const t of ROLE_TEMPLATES) assert.ok(!t.permissions.some(p => p.key === "sessions.manage"), "only the admin manages sessions by default");
    });
});

describe("date rules", () => {
    it("overlap includes the shared day; inside includes the edges", () => {
        assert.equal(rangesOverlap(r("2025-09-01", "2025-12-15"), r("2025-12-15", "2026-01-01")), true);
        assert.equal(rangesOverlap(r("2025-09-01", "2025-12-14"), r("2025-12-15", "2026-01-01")), false);
        assert.equal(rangeInside(r("2025-09-01", "2025-12-15"), r("2025-09-01", "2026-07-20")), true);
        assert.equal(rangeInside(r("2025-08-31", "2025-12-15"), r("2025-09-01", "2026-07-20")), false);
    });
    it("firstOverlap ignores the item being edited", () => {
        const items = [{ id: "a", ...r("2025-09-01", "2025-12-15") }, { id: "b", ...r("2026-01-05", "2026-04-01") }];
        assert.equal(firstOverlap(r("2025-10-01", "2025-11-01"), items)?.id, "a");
        assert.equal(firstOverlap(r("2025-10-01", "2025-11-01"), items, "a"), undefined);
    });
    it("session name must be two consecutive years", () => {
        assert.equal(isValidSessionName("2025/2026"), true);
        for (const bad of ["2025/2027", "2025-2026", "25/26", "2026/2025", ""]) assert.equal(isValidSessionName(bad), false, bad);
    });
});

describe("session DTOs", () => {
    it("create checks name, dates and unknown fields", () => {
        assert.equal(CreateSessionDto.safeParse({ name: "2025/2026", startDate: "2025-09-01", endDate: "2026-07-20" }).success, true);
        assert.equal(CreateSessionDto.safeParse({ name: "2025/2026", startDate: "2026-07-20", endDate: "2025-09-01" }).success, false);
        assert.equal(CreateSessionDto.safeParse({ name: "2025/2026", startDate: "soon", endDate: "2026-07-20" }).success, false);
        assert.equal(CreateSessionDto.safeParse({ name: "2025/2026", startDate: "2025-09-01", endDate: "2026-07-20", isCurrent: true }).success, false);
    });
    it("updates need one field; a term cannot be renamed", () => {
        assert.equal(UpdateSessionDto.safeParse({}).success, false);
        assert.equal(UpdateTermDto.safeParse({}).success, false);
        assert.equal(UpdateTermDto.safeParse({ name: "second" }).success, false);
        assert.equal(CreateTermDto.safeParse({ sessionId: SID, name: "fourth", startDate: "2025-09-01", endDate: "2025-12-15" }).success, false);
    });
    it("carryForward defaults to true, also with no body", () => {
        assert.deepEqual(SetCurrentTermDto.parse(undefined), { carryForward: true });
        assert.deepEqual(SetCurrentTermDto.parse({}), { carryForward: true });
        assert.deepEqual(SetCurrentTermDto.parse({ carryForward: false }), { carryForward: false });
    });
    it("calendar dto: end not before start, holiday type, blank clears", () => {
        assert.equal(CreateCalendarEventDto.safeParse({ title: "Sports day", startDate: "2025-11-10", endDate: "2025-11-09" }).success, false);
        assert.equal(CreateCalendarEventDto.parse({ title: "Sports day", startDate: "2025-11-10", endDate: "" }).endDate, undefined);
        assert.equal((UpdateCalendarEventDto.parse({ description: "" }) as any).description, null);
        assert.equal(UpdateCalendarEventDto.safeParse({}).success, false);
        assert.equal(ListCalendarEventsQuery.safeParse({ type: "party" }).success, false);
    });
});

describe("term roll-over planning", () => {
    const classes = [{ id: "c1", classTeacherId: "t1" }, { id: "c2", classTeacherId: null }];
    const subjects = [{ id: "math", defaultTeacherId: "tm" }, { id: "eng", defaultTeacherId: null }];
    it("copies last term's teachers as they were, then fills the rest by the default rules", () => {
        const previous = [{ classId: "c1", subjectId: "eng", staffId: "tx", assignedVia: "manual" }];
        const { carried, seeded } = planTermAssignments({ classes, subjects, previous, existing: [], teachingModel: "homeroom" });
        assert.deepEqual(carried, previous);
        assert.deepEqual(seeded.map(s => `${s.classId}:${s.subjectId}:${s.staffId}:${s.assignedVia}`).sort(),
            ["c1:math:tm:auto_subject_default", "c2:math:tm:auto_subject_default"]);   // c2 has no class teacher, so "eng" stays empty
    });
    it("a homeroom school uses the class teacher; other schools leave it empty", () => {
        const a = planTermAssignments({ classes, subjects: [subjects[1]], previous: [], existing: [], teachingModel: "homeroom" });
        assert.deepEqual(a.seeded.map(s => `${s.classId}:${s.staffId}`), ["c1:t1"]);
        const b = planTermAssignments({ classes, subjects: [subjects[1]], previous: [], existing: [], teachingModel: "subject_specialist" });
        assert.equal(b.seeded.length, 0);
    });
    it("never touches what already exists, and ignores deleted classes or subjects", () => {
        const p = planTermAssignments({ classes, subjects, existing: [{ classId: "c1", subjectId: "math" }],
            previous: [{ classId: "c1", subjectId: "math", staffId: "old", assignedVia: "manual" }, { classId: "gone", subjectId: "math", staffId: "s", assignedVia: "manual" }], teachingModel: null });
        assert.equal(p.carried.length, 0);
        assert.ok(!p.seeded.some(s => s.classId === "c1" && s.subjectId === "math"));
    });
    it("only students not yet enrolled are carried", () => {
        const out = planEnrolmentCarryForward([{ studentId: "a", classId: "c1" }, { studentId: "b", classId: "c1" }], new Set(["a"]));
        assert.deepEqual(out, [{ studentId: "b", classId: "c1" }]);
    });
    it("rolloverInTx uses a few set-based queries and reports counts; no previous term still seeds", async () => {
        const calls: string[] = [];
        const tx: any = {
            enrolment: { findMany: async (a: any) => { calls.push("enrol.find"); return a.where.termId === "old" ? [{ studentId: "a", classId: "c1" }, { studentId: "b", classId: "c1" }] : [{ studentId: "a" }]; },
                         createMany: async (a: any) => { calls.push(`enrol.create:${a.data.length}`); return { count: a.data.length }; } },
            class: { findMany: async () => classes }, subject: { findMany: async () => subjects },
            classSubject: { findMany: async () => [], createMany: async (a: any) => { calls.push(`cs.create:${a.data.length}`); return { count: a.data.length }; } },
            schoolSettings: { findFirst: async () => ({ teachingModel: "homeroom" }) },
        };
        const res = await rolloverInTx(tx, "old", "new");
        assert.equal(res.enrolmentsCarried, 1);
        assert.deepEqual(calls.filter(c => c.startsWith("enrol.create") || c.startsWith("cs.create")), ["enrol.create:1", "cs.create:3"]);
        const none = await rolloverInTx(tx, null, "new");
        assert.equal(none.enrolmentsCarried, 0);
    });
});

// ── use cases with in-memory fakes ───────────────────────────────────────────
const sm = new SessionMapper(), tm = new TermMapper();
const session = { id: SID, name: "2025/2026", ...r("2025-09-01", "2026-07-20"), isCurrent: false, createdAt: d("2025-01-01"), updatedAt: d("2025-01-01"),
    terms: [{ id: TID, sessionId: SID, name: "first", ...r("2025-09-08", "2025-12-12"), isCurrent: false, createdAt: d("2025-01-01"), updatedAt: d("2025-01-01") }] };
function fakes() {
    const state = { created: [] as any[], updated: [] as any[], audits: [] as any[] };
    const sessionRepository: any = {
        findAllSessions: async () => [session], findSessionById: async (id: string) => (id === SID ? session : null), findTermById: async (id: string) => (id === TID ? session.terms[0] : null),
        createSession: async (x: any) => { state.created.push(x); return { id: "new", isCurrent: false, createdAt: d("2025-01-01"), updatedAt: d("2025-01-01"), ...x }; },
        createTerm: async (x: any) => { state.created.push(x); return { id: "newterm", isCurrent: false, createdAt: d("2025-01-01"), updatedAt: d("2025-01-01"), ...x }; },
        updateSession: async (_i: string, x: any) => { state.updated.push(x); return session; }, updateTerm: async (_i: string, x: any) => { state.updated.push(x); return { ...session.terms[0], ...x }; },
    };
    const auditService: any = { log: async (p: any) => { state.audits.push(p); } };
    return { state, deps: { sessionRepository, sessionMapper: sm, termMapper: tm, auditService } };
}
const actor = { userId: "u1" };

describe("session commands", () => {
    it("create session refuses a name already used (any capitals) and overlapping dates, naming the clash", async () => {
        const { deps } = fakes();
        await assert.rejects(new CreateSessionUseCase(deps).execute("s", { name: "2025/2026", startDate: "2030-09-01", endDate: "2031-07-01" }, actor), { code: "SESSION_NAME_TAKEN" });
        await assert.rejects(new CreateSessionUseCase(deps).execute("s", { name: "2026/2027", startDate: "2026-07-01", endDate: "2027-07-01" }, actor), { code: "SESSION_DATES_OVERLAP", details: { session: "2025/2026" } });
    });
    it("create session saves and audits a clear year", async () => {
        const { deps, state } = fakes();
        const out = await new CreateSessionUseCase(deps).execute("s", { name: "2026/2027", startDate: "2026-09-01", endDate: "2027-07-20" }, actor);
        assert.equal(out.name, "2026/2027"); assert.deepEqual(out.terms, []);
        assert.equal(state.audits[0].action, "session.created");
    });
    it("a term must be inside its session, unique by name, and not overlap another term", async () => {
        const { deps } = fakes();
        const mk = (name: any, a: string, b: string) => new CreateTermUseCase(deps).execute("s", { sessionId: SID, name, startDate: a, endDate: b }, actor);
        await assert.rejects(mk("second", "2026-07-01", "2026-09-01"), { code: "TERM_OUTSIDE_SESSION" });
        await assert.rejects(mk("first", "2026-01-05", "2026-04-01"), { code: "TERM_NAME_TAKEN" });
        await assert.rejects(mk("second", "2025-12-01", "2026-04-01"), { code: "TERM_DATES_OVERLAP" });
        const ok = await mk("second", "2026-01-05", "2026-04-01");
        assert.equal(ok.session?.name, "2025/2026");   // the term comes with its session's name, not only an id
    });
    it("shrinking a session below one of its terms is refused", async () => {
        const { deps } = fakes();
        await assert.rejects(new UpdateSessionUseCase(deps).execute("s", SID, { endDate: "2025-11-30" }, actor), { code: "SESSION_EXCLUDES_TERMS" });
    });
    it("update term writes and audits only the date that changed, with names in the audit", async () => {
        const { deps, state } = fakes();
        const out = await new UpdateTermUseCase(deps).execute("s", TID, { startDate: "2025-09-08", endDate: "2025-12-10" }, actor);
        assert.deepEqual(Object.keys(state.updated[0]), ["endDate"]);
        assert.equal(state.audits[0].oldValue.session, "2025/2026"); assert.equal(out.session?.name, "2025/2026");
        await assert.rejects(new UpdateTermUseCase(deps).execute("s", "nope", { endDate: "2025-12-10" }, actor), { code: "NOT_FOUND" });
    });
});

describe("calendar events", () => {
    function calFakes() {
        const created: any[] = [];
        const sessionRepository: any = { findAllSessions: async () => [session], findSessionById: async (id: string) => (id === SID ? session : null), findTermById: async (id: string) => (id === TID ? session.terms[0] : null) };
        const calendarRepository: any = { createCalendarEvent: async (x: any) => { created.push(x); return { id: "e1", createdAt: d("2025-01-01"), updatedAt: d("2025-01-01"), description: null, endDate: null, ...x }; } };
        const audits: any[] = []; const auditService: any = { log: async (p: any) => audits.push(p) };
        return { created, deps: { calendarRepository, sessionRepository, calendarEventMapper: new CalendarEventMapper(), auditService } };
    }
    it("saves only real columns (no calendarId), derives the session from the term, and answers with names", async () => {
        const { deps, created } = calFakes();
        const out = await new CreateCalendarEventUseCase(deps).execute("s", { title: "Mid-term break", type: "holiday", startDate: "2025-10-20", termId: TID } as any, actor);
        assert.equal(created[0].isHoliday, true); assert.equal(created[0].sessionId, SID); assert.equal(created[0].createdById, "u1");
        assert.ok(!("calendarId" in created[0]));
        assert.deepEqual(out.term, { id: TID, name: "first" }); assert.deepEqual(out.session, { id: SID, name: "2025/2026" });
    });
    it("refuses a term and a session that do not match, and unknown terms", async () => {
        const { deps } = calFakes();
        await assert.rejects(new CreateCalendarEventUseCase(deps).execute("s", { title: "x", type: "event", startDate: "2025-10-20", termId: TID, sessionId: "33333333-3333-4333-8333-333333333333" } as any, actor), { code: "EVENT_SCOPE_MISMATCH" });
        await assert.rejects(new CreateCalendarEventUseCase(deps).execute("s", { title: "x", type: "event", startDate: "2025-10-20", termId: "44444444-4444-4444-8444-444444444444" } as any, actor), { code: "NOT_FOUND" });
    });
});

// ── roll-over: classes that end up over capacity ─────────────────────────────
import { planOverCapacity } from "../../src/modules/sessions/services/term-rollover";

describe("roll-over over-capacity report", () => {
    it("lists only classes above their capacity, worst first; no capacity means never over; exactly full is fine", () => {
        const cls = [{ id: "a", name: "JSS 1", capacity: 2 }, { id: "b", name: "JSS 2", capacity: 1 }, { id: "c", name: "JSS 3", capacity: null }, { id: "d", name: "JSS 4", capacity: 2 }];
        const out = planOverCapacity(cls, ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", null, undefined]);
        assert.deepEqual(out, [{ classId: "b", name: "JSS 2", capacity: 1, enrolled: 3 }, { classId: "a", name: "JSS 1", capacity: 2, enrolled: 3 }]);
    });
    it("rolloverInTx carries everyone anyway and reports the full class; nothing extra is queried when no one is carried", async () => {
        const enrolFinds: any[] = [];
        const tx: any = {
            enrolment: {
                findMany: async (a: any) => { enrolFinds.push(a); return a.where.termId === "old" ? [{ studentId: "a", classId: "c1" }, { studentId: "b", classId: "c1" }, { studentId: "c", classId: "c1" }]
                    : a.select?.classId ? [{ classId: "c1" }, { classId: "c1" }, { classId: "c1" }] : []; },
                createMany: async (a: any) => ({ count: a.data.length }),
            },
            class: { findMany: async () => [{ id: "c1", name: "JSS 1", capacity: 2, classTeacherId: null }] }, subject: { findMany: async () => [] },
            classSubject: { findMany: async () => [], createMany: async () => ({ count: 0 }) }, schoolSettings: { findFirst: async () => null },
        };
        const res = await rolloverInTx(tx, "old", "new");
        assert.equal(res.enrolmentsCarried, 3);
        assert.deepEqual(res.overCapacity, [{ classId: "c1", name: "JSS 1", capacity: 2, enrolled: 3 }]);
        const before = enrolFinds.length;
        const none = await rolloverInTx(tx, null, "new");
        assert.deepEqual(none.overCapacity, []);
        assert.equal(enrolFinds.length, before, "no enrolment queries when there is no previous term");
    });
});
