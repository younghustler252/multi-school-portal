import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotificationDispatchService } from "../../src/modules/notifications/services/notification-dispatch.service";
import { EVENT_SETTING_DEFS } from "../../src/modules/events/events.settings";
import { SETTING_DEFS } from "../../src/foundation/settings.registry";
import { buildEventMessage, hasStarted, noticeKey, reminderAnchor, targetTypeOf, wantsOf, whenText, zonedInstant } from "../../src/modules/events/domain/event.notice";
import { EventNoticeService } from "../../src/modules/events/services/event-notice.service";
import { EventViewerService } from "../../src/modules/events/services/event-viewer.service";
import { CancelEventUseCase } from "../../src/modules/events/usecases/events.usecases";
import { PublishEventUseCase, RescheduleEventUseCase, CancelPublishedEventUseCase, NotifyEventUseCase, PreviewEventAudienceUseCase } from "../../src/modules/events/usecases/event-lifecycle.usecases";
import { EventMapper } from "../../src/modules/events/mappers/event.mapper";

const d = (s: string) => new Date(s);
const code = (c: string) => ({ code: c });
const access = (can: string[], scope: "ALL" | string[]): any => ({ can: (k: string) => can.includes(k), scopeOf: () => "ALL", branchScope: () => scope });
const all = access(["events.manage", "events.publish"], "ALL");
const actor = { userId: "u1" };
const ev = (o: any = {}): any => ({ id: "e1", title: "Sports day", description: null, startDate: d("2030-12-05"), endDate: null, type: "sports", isHoliday: false, status: "PUBLISHED", isAllDay: true, startTime: null, endTime: null, location: "Field", audienceKinds: ["EVERYONE"], branchIds: [], classIds: [], notifyChannels: ["IN_APP"], reminderOffsetsMinutes: [], revision: 1, publishNoticeSentAt: null, cancelReason: null, createdAt: d("2026-01-01"), updatedAt: d("2026-01-01"), createdById: "u1", termId: null, sessionId: null, ...o });

describe("event notice rules (pure)", () => {
    it("the setting exists, is a boolean and defaults OFF", () => {
        assert.equal(EVENT_SETTING_DEFS[0].key, "events.notifications_enabled");
        const def: any = SETTING_DEFS.find((s: any) => s.key === "events.notifications_enabled");
        assert.equal(def.kind, "boolean"); assert.equal(def.default, false);
    });
    it("audience kinds → groups; only one staff kind narrows by category", () => {
        assert.deepEqual(wantsOf(["EVERYONE"]), { students: true, guardians: true, staff: true, staffCategories: undefined });
        assert.deepEqual(wantsOf(["TEACHING_STAFF"]), { students: false, guardians: false, staff: true, staffCategories: ["teaching"] });
        assert.deepEqual(wantsOf(["NON_TEACHING_STAFF", "STUDENTS"]).staffCategories, ["non_teaching"]);
        assert.equal(wantsOf(["TEACHING_STAFF", "NON_TEACHING_STAFF"]).staffCategories, undefined);
        assert.equal(targetTypeOf(["STUDENTS"]), "ALL_STUDENTS"); assert.equal(targetTypeOf(["GUARDIANS"]), "ALL_PARENTS");
        assert.equal(targetTypeOf(["TEACHING_STAFF", "NON_TEACHING_STAFF"]), "ALL_STAFF"); assert.equal(targetTypeOf(["STUDENTS", "GUARDIANS"]), "EVERYONE");
    });
    it("wall-clock time in a zone becomes the right instant (Lagos is UTC+1; New York shifts with daylight time)", () => {
        assert.equal(zonedInstant("2030-12-05", "09:30", "Africa/Lagos").toISOString(), "2030-12-05T08:30:00.000Z");
        assert.equal(zonedInstant("2030-07-01", "09:00", "America/New_York").toISOString(), "2030-07-01T13:00:00.000Z");
        assert.equal(zonedInstant("2030-12-01", "09:00", "America/New_York").toISOString(), "2030-12-01T14:00:00.000Z");
        assert.equal(reminderAnchor(ev(), "Africa/Lagos").toISOString(), "2030-12-05T07:00:00.000Z");     // all-day: 08:00 school time
    });
    it("started: an all-day event starts at 00:00 school time; a timed one at its start time", () => {
        const tz = "Africa/Lagos";
        assert.equal(hasStarted(ev(), d("2030-12-04T22:59:00Z"), tz), false); assert.equal(hasStarted(ev(), d("2030-12-04T23:00:00Z"), tz), true);
        const timed = ev({ isAllDay: false, startTime: "10:00" });
        assert.equal(hasStarted(timed, d("2030-12-05T08:59:00Z"), tz), false); assert.equal(hasStarted(timed, d("2030-12-05T09:00:00Z"), tz), true);
    });
    it("messages and keys", () => {
        assert.equal(whenText(ev({ isAllDay: false, startTime: "09:30", endTime: "11:00" })), "Thu, 5 Dec 2030, 09:30-11:00");
        assert.match(buildEventMessage("published", ev()).message, /Sports day: Thu, 5 Dec 2030 \(all day\)\. Venue: Field\./);
        assert.match(buildEventMessage("cancelled", ev({ status: "CANCELLED", cancelReason: "Rain" })).message, /has been cancelled\. Reason: Rain\./);
        assert.notEqual(noticeKey(ev({ revision: 2 }), "rescheduled", "STUDENT", "s1", "EMAIL"), noticeKey(ev({ revision: 3 }), "rescheduled", "STUDENT", "s1", "EMAIL"));
        assert.equal(noticeKey(ev({ revision: 2 }), "published", "STUDENT", "s1", "EMAIL"), noticeKey(ev({ revision: 9 }), "published", "STUDENT", "s1", "EMAIL"));
    });
});

// ── a dispatch service on an in-memory notification repository ───────────────
function notifyWorld(opts: { enabled?: boolean; allowed?: string[]; people?: any[] } = {}) {
    const keys = new Set<string>(), recipients: any[] = [], notifications: any[] = [], queued: any[] = [], audits: any[] = [], updates: any[] = [];
    const notificationRepository: any = {
        findExistingIdempotencyKeys: async (ks: string[]) => new Set(ks.filter(k => keys.has(k))),
        createSchoolNotification: async (x: any) => { const n = { id: `n${notifications.length + 1}`, ...x }; notifications.push(n); return n; },
        createSchoolRecipientsBatch: async (rows: any[]) => { for (const r of rows) { if (r.idempotencyKey) keys.add(r.idempotencyKey); recipients.push(r); } return rows.length; },
        findUnqueuedDeliverables: async () => [], markSchoolRecipientsQueued: async () => undefined,
    };
    const dispatch = new NotificationDispatchService({ notificationRepository, notificationDeliveryQueue: { enqueue: async (j: any) => { queued.push(...j); } }, tenantInfo: () => ({ schoolId: "s", tenantSchema: "t" }) });
    const people = opts.people ?? [{ type: "STUDENT", id: "st1", userId: "u-st1", email: "a@x", phone: null }, { type: "GUARDIAN", id: "g1", userId: "u-g1", email: null, phone: "0800" }];
    const resolved: any[] = [];
    const audienceRecipientService: any = { resolve: async (q: any) => { resolved.push(q); return people; } };
    const channelPolicyService: any = { evaluate: async (_s: string, ch: string[]) => ({ allowed: ch.filter(c => (opts.allowed ?? ["IN_APP"]).includes(c)), blocked: ch.filter(c => !(opts.allowed ?? ["IN_APP"]).includes(c)).map(channel => ({ channel, reason: "plan" })) }) };
    const schoolPreferencesService: any = { all: async () => ({ "events.notifications_enabled": opts.enabled ?? true }) };
    const eventRepository: any = { update: async (id: string, w: any) => { updates.push({ id, ...w.data }); } };
    const auditService: any = { log: async (p: any) => { audits.push(p); } };
    const eventNoticeService = new EventNoticeService({ eventRepository, audienceRecipientService, notificationDispatchService: dispatch, channelPolicyService, auditService, schoolPreferencesService });
    return { eventNoticeService, recipients, notifications, audits, updates, resolved };
}

describe("event notice service", () => {
    it("OFF (the default): nothing is created, no recipient lookup happens", async () => {
        const w = notifyWorld({ enabled: false });
        assert.deepEqual(await w.eventNoticeService.send("s", ev(), "published", "u1"), { sent: false, reason: "notifications_disabled" });
        assert.equal(w.recipients.length, 0); assert.equal(w.resolved.length, 0);
    });
    it("ON: one in-app row per person, honouring the audience; blocked channels are reported; repeating sends nothing new", async () => {
        const w = notifyWorld({ allowed: ["IN_APP", "EMAIL"] });
        const e = ev({ notifyChannels: ["IN_APP", "EMAIL", "SMS"], audienceKinds: ["TEACHING_STAFF"], branchIds: ["b1"] });
        const first: any = await w.eventNoticeService.send("s", e, "published", "u1");
        assert.deepEqual(w.resolved[0], { wantsStudents: false, wantsGuardians: false, wantsStaff: true, filter: { branchIds: ["b1"], classIds: [], staffCategories: ["teaching"] } });
        assert.equal(first.sent, true); assert.deepEqual(first.blockedChannels, [{ channel: "SMS", reason: "plan" }]);
        // student has an email, guardian has none: IN_APP x2 + EMAIL x1
        assert.equal(w.recipients.length, 3); assert.equal(w.notifications[0].type, "event"); assert.equal(w.notifications[0].metadata.source, "event");
        assert.deepEqual(w.updates.map(u => Object.keys(u).sort()), [["id", "publishNoticeSentAt"]]);
        const again: any = await w.eventNoticeService.send("s", e, "published", "u1");
        assert.equal(again.created, 0); assert.equal(again.duplicates, 3); assert.equal(w.recipients.length, 3);
    });
    it("a holiday event goes out as a holiday notice; each reschedule revision notifies again, once", async () => {
        const w = notifyWorld();
        await w.eventNoticeService.send("s", ev({ isHoliday: true }), "published", "u1");
        assert.equal(w.notifications[0].type, "holiday");
        await w.eventNoticeService.send("s", ev({ revision: 2 }), "rescheduled", "u1");
        await w.eventNoticeService.send("s", ev({ revision: 2 }), "rescheduled", "u1");
        await w.eventNoticeService.send("s", ev({ revision: 3 }), "rescheduled", "u1");
        assert.equal(w.recipients.filter(r => r.idempotencyKey.includes(":rescheduled:")).length, 4);   // 2 people x 2 revisions
    });
    it("no channel allowed or nobody in the audience: nothing sent, no error", async () => {
        assert.deepEqual(await notifyWorld({ allowed: [] }).eventNoticeService.send("s", ev(), "published", "u1"), { sent: false, reason: "no_channels" });
        assert.deepEqual(await notifyWorld({ people: [] }).eventNoticeService.send("s", ev(), "published", "u1"), { sent: false, reason: "no_recipients" });
    });
});

// ── lifecycle use cases ──────────────────────────────────────────────────────
function lifeWorld(seed: any[], opts: any = {}) {
    const nw = notifyWorld(opts);
    const rows = new Map<string, any>(seed.map(r => [r.id, r]));
    const eventRepository: any = {
        listRemindersFor: async () => [],
        findById: async (id: string) => rows.get(id) ?? null,
        update: async (id: string, { data }: any) => { const r = { ...rows.get(id), ...data }; rows.set(id, r); return r; },
    };
    const synced: any[] = [];
    const audits: any[] = []; const auditService: any = { log: async (p: any) => { audits.push(p); } };
    const deps: any = { eventRepository, schoolRepository: { findById: async () => ({ timezone: "Africa/Lagos" }) }, sessionRepository: { findAllSessions: async () => [] }, eventMapper: new EventMapper(), auditService, eventNoticeService: nw.eventNoticeService, eventReminderService: { sync: async (_s: string, e: any) => { synced.push([e.id, e.revision, e.status]); } } };
    deps.cancelEventUseCase = new CancelEventUseCase(deps);
    // the notice service updates through its own repository stub; give it the real rows too
    (nw.eventNoticeService as any).d.eventRepository = eventRepository;
    return { rows, audits, deps, nw, synced };
}

describe("event lifecycle use cases", () => {
    it("publish: draft → published, audited, tells the audience; again changes nothing; cancelled refused; needs publish scope", async () => {
        const w = lifeWorld([ev({ id: "dr", status: "DRAFT" }), ev({ id: "ca", status: "CANCELLED" })]);
        const pub = new PublishEventUseCase(w.deps);
        const out = await pub.execute("s", "dr", actor, all);
        assert.equal(out.event.status, "PUBLISHED"); assert.equal(out.changed, true); assert.equal((out.notice as any).sent, true);
        assert.deepEqual(w.synced, [["dr", 1, "PUBLISHED"]]);
        assert.equal(w.rows.get("dr").publishedById, "u1"); assert.equal(w.audits[0].action, "calendar_event.published");
        const again = await pub.execute("s", "dr", actor, all);
        assert.equal(again.changed, false); assert.equal(again.notice, null);
        await assert.rejects(pub.execute("s", "ca", actor, all), code("EVENT_CANCELLED"));
        await assert.rejects(pub.execute("s", "dr", actor, access(["events.manage"], ["b1"])), { code: "EVENT_OUT_OF_SCOPE" });
        await assert.rejects(pub.execute("s", "nope", actor, all), { code: "NOT_FOUND" });
    });
    it("publish with notices OFF still publishes and says nobody was told; an event that has started is published without a notice", async () => {
        const off = lifeWorld([ev({ id: "dr", status: "DRAFT" })], { enabled: false });
        const o = await new PublishEventUseCase(off.deps).execute("s", "dr", actor, all);
        assert.equal(o.event.status, "PUBLISHED"); assert.deepEqual(o.notice, { sent: false, reason: "notifications_disabled" }); assert.equal(off.nw.recipients.length, 0);
        const past = lifeWorld([ev({ id: "dr", status: "DRAFT", startDate: d("2020-01-01") })]);
        assert.deepEqual((await new PublishEventUseCase(past.deps).execute("s", "dr", actor, all)).notice, { sent: false, reason: "already_started" });
        assert.equal(past.nw.recipients.length, 0);
    });
    it("reschedule: published only; a real move bumps the revision and notifies once; the same schedule does nothing", async () => {
        const w = lifeWorld([ev({ id: "p" }), ev({ id: "dr", status: "DRAFT" })]);
        const re = new RescheduleEventUseCase(w.deps);
        const same = await re.execute("s", "p", { startDate: "2030-12-05", isAllDay: true } as any, actor, all);
        assert.equal(same.changed, false); assert.equal(w.rows.get("p").revision, 1);
        const moved = await re.execute("s", "p", { startDate: "2030-12-06", isAllDay: false, startTime: "10:00" } as any, actor, all);
        assert.equal(moved.changed, true); assert.equal(moved.event.revision, 2); assert.equal(moved.event.startTime, "10:00");
        assert.deepEqual(w.synced.at(-1), ["p", 2, "PUBLISHED"]);
        assert.equal(w.audits.at(-1).action, "calendar_event.rescheduled"); assert.equal(w.nw.recipients.length, 2);
        await assert.rejects(re.execute("s", "dr", { startDate: "2030-12-06" } as any, actor, all), code("EVENT_NOT_PUBLISHED"));
        await assert.rejects(re.execute("s", "p", { startDate: "2030-12-06", isAllDay: false } as any, actor, all), code("EVENT_TIME_REQUIRED"));
        await assert.rejects(re.execute("s", "p", { startDate: "2030-12-06" } as any, actor, access([], [])), { code: "EVENT_OUT_OF_SCOPE" });
    });
    it("cancel route: tells the audience once; cancelling again is quiet; the old delete route never tells anyone", async () => {
        const w = lifeWorld([ev({ id: "p" }), ev({ id: "q" })]);
        const out = await new CancelPublishedEventUseCase(w.deps).execute("s", "p", { reason: "Rain" } as any, actor, all);
        assert.equal(out.event.status, "CANCELLED"); assert.equal((out.notice as any).sent, true); assert.deepEqual(w.synced, [["p", 1, "CANCELLED"]]); assert.equal(w.nw.recipients.length, 2);
        const again = await new CancelPublishedEventUseCase(w.deps).execute("s", "p", {} as any, actor, all);
        assert.equal(again.changed, false); assert.equal(again.notice, null); assert.equal(w.nw.recipients.length, 2);
        await w.deps.cancelEventUseCase.execute("s", "q", actor, { via: "legacy_delete" });
        assert.equal(w.rows.get("q").status, "CANCELLED"); assert.equal(w.nw.recipients.length, 2);
    });
    it("manual notify: matching state only, refused when off or started, repeat sends nothing new", async () => {
        const w = lifeWorld([ev({ id: "p" }), ev({ id: "r", revision: 2 }), ev({ id: "dr", status: "DRAFT" }), ev({ id: "old", startDate: d("2020-01-01") })]);
        const nt = new NotifyEventUseCase(w.deps);
        await assert.rejects(nt.execute("s", "dr", "published", actor, all), code("EVENT_NOTICE_NOT_APPLICABLE"));
        await assert.rejects(nt.execute("s", "p", "rescheduled", actor, all), code("EVENT_NOTICE_NOT_APPLICABLE"));
        await assert.rejects(nt.execute("s", "p", "cancelled", actor, all), code("EVENT_NOTICE_NOT_APPLICABLE"));
        await assert.rejects(nt.execute("s", "old", "published", actor, all), code("EVENT_ALREADY_STARTED"));
        const first: any = await nt.execute("s", "p", "published", actor, all);
        assert.equal(first.created, 2);
        assert.equal(((await nt.execute("s", "p", "published", actor, all)) as any).created, 0);
        assert.equal(((await nt.execute("s", "r", "rescheduled", actor, all)) as any).created, 2);
        const off = lifeWorld([ev({ id: "p" })], { enabled: false });
        await assert.rejects(new NotifyEventUseCase(off.deps).execute("s", "p", "published", actor, all), code("EVENT_NOTIFICATIONS_OFF"));
    });
    it("audience preview counts people by group and contact, and sends nothing", async () => {
        const w = lifeWorld([ev({ id: "p" })]);
        assert.deepEqual(await new PreviewEventAudienceUseCase(w.deps).execute("p", all), { audience: { kinds: ["EVERYONE"], branchIds: [], classIds: [] }, total: 2, students: 1, guardians: 1, staff: 0, withEmail: 1, withPhone: 1 });
        assert.equal(w.nw.recipients.length, 0);
        await assert.rejects(new PreviewEventAudienceUseCase(w.deps).execute("p", access([], [])), { code: "EVENT_OUT_OF_SCOPE" });
    });
});

describe("who sees an event (viewer matcher)", () => {
    const repo = (hit: boolean, calls: any[] = []) => ({ findMany: async (w: any) => { calls.push(w); return hit ? [{ id: "x" }] : []; } }) as any;
    const svc = (hit: boolean, calls: any[] = []) => new EventViewerService({ studentRepository: repo(hit, calls), guardianRepository: repo(hit, calls), staffRepository: repo(hit, calls) });
    const as = (persona: string) => ({ ...access([], "ALL"), persona, personaEntityId: "me" });
    it("managers see everything; nobody but managers sees a draft", async () => {
        assert.equal(await svc(false).forViewer(all)(ev({ status: "DRAFT", audienceKinds: ["STUDENTS"] })), true);
        assert.equal(await svc(true).forViewer(as("STUDENT"))(ev({ status: "DRAFT" })), false);
    });
    it("audience kinds decide by persona; whole-school events need no lookup", async () => {
        const calls: any[] = [];
        assert.equal(await svc(false, calls).forViewer(as("STUDENT"))(ev()), true);
        assert.equal(await svc(false, calls).forViewer(as("GUARDIAN"))(ev({ audienceKinds: ["STUDENTS"] })), false);
        assert.equal(await svc(false, calls).forViewer(as("STAFF"))(ev({ audienceKinds: ["GUARDIANS", "STUDENTS"] })), false);
        assert.equal(await svc(false, calls).forViewer(as("STAFF"))(ev({ audienceKinds: ["TEACHING_STAFF"], status: "CANCELLED" })), false);
        assert.equal(calls.length, 1);      // only the teaching-staff case needed a lookup
    });
    it("branch / class / category narrowing asks the same audience rules the sender uses, once per distinct audience", async () => {
        const calls: any[] = [];
        const v = svc(true, calls).forViewer(as("STUDENT"));
        assert.equal(await v(ev({ id: "a", audienceKinds: ["STUDENTS"], branchIds: ["b1"] })), true);
        assert.equal(await v(ev({ id: "b", audienceKinds: ["STUDENTS"], branchIds: ["b1"] })), true);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0], { AND: [{ id: "me" }, { AND: [{ branchId: { in: ["b1"] } }] }] });
        assert.equal(await svc(false).forViewer(as("STUDENT"))(ev({ audienceKinds: ["STUDENTS"], classIds: ["c1"] })), false);
    });
    it("a person with no record id sees no targeted event", async () => {
        assert.equal(await svc(true).forViewer({ ...access([], "ALL"), persona: "STUDENT", personaEntityId: null })(ev()), false);
    });
});
