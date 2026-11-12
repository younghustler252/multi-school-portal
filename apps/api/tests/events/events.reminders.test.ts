import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { humanOffset, planReminders, reminderKey } from "../../src/modules/events/domain/event.reminders";
import { buildReminderMessage } from "../../src/modules/events/domain/event.notice";
import { EventReminderService } from "../../src/modules/events/services/event-reminder.service";
import { RunDueEventRemindersUseCase, RunEventRemindersForAllSchoolsUseCase } from "../../src/modules/events/usecases/event-reminders.usecases";
import { UploadEventCoverUseCase, RemoveEventCoverUseCase } from "../../src/modules/events/usecases/event-cover.usecases";
import { EventMapper } from "../../src/modules/events/mappers/event.mapper";

const d = (s: string) => new Date(s);
const TZ = "Africa/Lagos";
const ev = (o: any = {}): any => ({ id: "e1", title: "Sports day", description: null, startDate: d("2030-12-05"), endDate: null, type: "sports", isHoliday: false, status: "PUBLISHED", isAllDay: false, startTime: "10:00", endTime: null, location: "Field", audienceKinds: ["EVERYONE"], branchIds: [], classIds: [], notifyChannels: ["IN_APP"], reminderOffsetsMinutes: [1440, 60], revision: 1, publishedById: "pub", createdById: "cr", coverImageUrl: null, ...o });

describe("reminder planning (pure)", () => {
    it("due time = start - offset in school time; largest offset first; duplicates dropped", () => {
        const rows = planReminders(ev({ reminderOffsetsMinutes: [60, 1440, 60] }), TZ, d("2030-01-01"));
        assert.deepEqual(rows.map(r => [r.offsetMinutes, r.dueAt.toISOString(), r.status]), [[1440, "2030-12-04T09:00:00.000Z", "PENDING"], [60, "2030-12-05T08:00:00.000Z", "PENDING"]]);
    });
    it("an all-day event counts back from 08:00 school time", () => {
        assert.equal(planReminders(ev({ isAllDay: true, startTime: null, reminderOffsetsMinutes: [1440] }), TZ, d("2030-01-01"))[0].dueAt.toISOString(), "2030-12-04T07:00:00.000Z");
    });
    it("a reminder already past when planned is made SKIPPED, never PENDING", () => {
        const rows = planReminders(ev(), TZ, d("2030-12-05T08:30:00Z"));
        assert.deepEqual(rows.map(r => r.status), ["SKIPPED", "SKIPPED"]);
        assert.deepEqual(planReminders(ev(), TZ, d("2030-12-04T12:00:00Z")).map(r => r.status), ["SKIPPED", "PENDING"]);
    });
    it("text and keys", () => {
        assert.deepEqual([1, 60, 90, 1440, 2880, 10080, 20160].map(humanOffset), ["1 minute", "1 hour", "90 minutes", "1 day", "2 days", "1 week", "2 weeks"]);
        assert.match(buildReminderMessage(ev(), 1440).message, /^Sports day is in 1 day: .* 10:00\. Venue: Field\.$/);
        assert.notEqual(reminderKey(ev(), 60, "STUDENT", "s", "SMS"), reminderKey(ev({ revision: 2 }), 60, "STUDENT", "s", "SMS"));
    });
});

// ── in-memory repository (the real impl is exercised separately against a fake prisma model) ─────
function memRepo(events: any[] = []) {
    const rows: any[] = []; const evs = new Map(events.map(e => [e.id, e]));
    const repo: any = {
        findById: async (id: string) => evs.get(id) ?? null,
        syncReminders: async (eventId: string, planned: any[]) => {
            for (const r of rows.filter(r => r.eventId === eventId && r.status === "PENDING" && !planned.some(p => p.revision === r.revision && p.offsetMinutes === r.offsetMinutes))) r.status = "CANCELLED";
            for (const p of planned) if (!rows.some(r => r.eventId === eventId && r.revision === p.revision && r.offsetMinutes === p.offsetMinutes)) rows.push({ id: `r${rows.length + 1}`, eventId, attempts: 0, ...p });
        },
        cancelPendingReminders: async (eventId: string) => { for (const r of rows) if (r.eventId === eventId && r.status === "PENDING") r.status = "CANCELLED"; },
        recoverStaleReminders: async () => 0,
        claimDueReminders: async (now: Date, limit: number) => rows.filter(r => r.status === "PENDING" && r.dueAt <= now).slice(0, limit).map(r => { r.status = "PROCESSING"; r.attempts++; return { ...r }; }),
        finishReminder: async (id: string, status: string, note: string | null = null) => { Object.assign(rows.find(r => r.id === id), { status, lastError: note }); },
    };
    return { repo, rows };
}
const school: any = { findById: async () => ({ timezone: TZ }) };

describe("reminder rows follow the event", () => {
    it("publish makes one row per offset; a new revision replaces pending rows; cancel cancels them; an offset change adds/removes", async () => {
        const e = ev(); const m = memRepo([e]); const svc = new EventReminderService({ eventRepository: m.repo, schoolRepository: school });
        const now = d("2030-01-01");
        await svc.sync("s", e, now);
        assert.deepEqual(m.rows.map(r => [r.revision, r.offsetMinutes, r.status]), [[1, 1440, "PENDING"], [1, 60, "PENDING"]]);
        await svc.sync("s", e, now);                                     // idempotent
        assert.equal(m.rows.length, 2);
        await svc.sync("s", { ...e, revision: 2, startTime: "11:00" }, now);
        assert.deepEqual(m.rows.map(r => `${r.revision}:${r.offsetMinutes}:${r.status}`), ["1:1440:CANCELLED", "1:60:CANCELLED", "2:1440:PENDING", "2:60:PENDING"]);
        await svc.sync("s", { ...e, revision: 2, reminderOffsetsMinutes: [60, 15] }, now);
        assert.deepEqual(m.rows.filter(r => r.revision === 2).map(r => `${r.offsetMinutes}:${r.status}`), ["1440:CANCELLED", "60:PENDING", "15:PENDING"]);
        await svc.sync("s", { ...e, revision: 2, status: "CANCELLED" }, now);
        assert.equal(m.rows.filter(r => r.status === "PENDING").length, 0);
    });
});

// ── the sender ───────────────────────────────────────────────────────────────
function runWorld(opts: { event?: any; sendResult?: any; sendThrows?: boolean; now?: string } = {}) {
    const event = opts.event ?? ev();
    const m = memRepo([event]);
    m.rows.push({ id: "r1", eventId: event.id, revision: event.revision, offsetMinutes: 60, dueAt: d("2030-12-05T08:00:00Z"), status: "PENDING", attempts: 0 });
    const sent: any[] = [];
    const eventNoticeService: any = { sendReminder: async (...a: any[]) => { sent.push(a); if (opts.sendThrows) throw new Error("queue down"); return opts.sendResult ?? { sent: true, recipients: 2, created: 2, duplicates: 0, byChannel: {}, blockedChannels: [] }; } };
    const uc = new RunDueEventRemindersUseCase({ eventRepository: m.repo, schoolRepository: school, eventNoticeService }, () => d(opts.now ?? "2030-12-05T08:03:00Z"));
    return { uc, m, sent };
}

describe("sending due reminders", () => {
    it("a due reminder is sent once and marked SENT; a second tick sends nothing", async () => {
        const w = runWorld();
        assert.deepEqual(await w.uc.execute("s"), { claimed: 1, sent: 1, skipped: 0, cancelled: 0, failed: 0, retried: 0, recovered: 0 });
        assert.equal(w.m.rows[0].status, "SENT"); assert.deepEqual(w.sent[0].slice(2, 4), [60, "pub"]);
        assert.equal((await w.uc.execute("s")).claimed, 0); assert.equal(w.sent.length, 1);
    });
    it("not yet due: untouched", async () => {
        const w = runWorld({ now: "2030-12-05T07:59:00Z" });
        assert.equal((await w.uc.execute("s")).claimed, 0); assert.equal(w.m.rows[0].status, "PENDING");
    });
    it("notices OFF: SKIPPED with the reason, and it never replays after switching on", async () => {
        const w = runWorld({ sendResult: { sent: false, reason: "notifications_disabled" } });
        assert.equal((await w.uc.execute("s")).skipped, 1);
        assert.deepEqual([w.m.rows[0].status, w.m.rows[0].lastError], ["SKIPPED", "notifications_disabled"]);
        assert.equal((await w.uc.execute("s")).claimed, 0);
    });
    it("cancelled, moved-on revision or missing event: CANCELLED and nothing sent; an event that has started: SKIPPED", async () => {
        for (const event of [ev({ status: "CANCELLED" }), ev({ revision: 2 })]) { const w = runWorld({ event }); w.m.rows[0].revision = 1; assert.equal((await w.uc.execute("s")).cancelled, 1); assert.equal(w.sent.length, 0); }
        const gone = runWorld(); gone.m.rows[0].eventId = "missing"; assert.equal((await gone.uc.execute("s")).cancelled, 1);
        const started = runWorld({ now: "2030-12-05T09:30:00Z" }); assert.equal((await started.uc.execute("s")).skipped, 1); assert.equal(started.sent.length, 0);
    });
    it("a failure is retried on the next tick, and FAILED after three tries", async () => {
        const w = runWorld({ sendThrows: true });
        assert.equal((await w.uc.execute("s")).retried, 1); assert.equal(w.m.rows[0].status, "PENDING");
        assert.equal((await w.uc.execute("s")).retried, 1);
        assert.equal((await w.uc.execute("s")).failed, 1);
        assert.deepEqual([w.m.rows[0].status, w.m.rows[0].lastError, w.m.rows[0].attempts], ["FAILED", "queue down", 3]);
        assert.equal((await w.uc.execute("s")).claimed, 0);
    });
    it("all schools: each runs in its own context; one school crashing never stops the rest", async () => {
        const ran: string[] = [];
        const one: any = { execute: async (id: string) => { if (id === "bad") throw new Error("boom"); ran.push(id); return { claimed: 2, sent: 1, skipped: 1, cancelled: 0, failed: 0, retried: 0, recovered: 0 }; } };
        const uc = new RunEventRemindersForAllSchoolsUseCase({ runDueEventRemindersUseCase: one }, async () => [{ id: "a", name: "A", schemaName: "ta" }, { id: "bad", name: "B", schemaName: "tb" }, { id: "c", name: "C", schemaName: "tc" }], async (_s, fn) => fn());
        assert.deepEqual(await uc.execute(), { schools: 3, claimed: 4, sent: 2, skipped: 2, failed: 0, crashed: [{ schoolId: "bad", error: "boom" }] });
        assert.deepEqual(ran, ["a", "c"]);
    });
});

// ── cover image ──────────────────────────────────────────────────────────────
describe("event cover image", () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const all: any = { can: () => true, scopeOf: () => "ALL", branchScope: () => "ALL" };
    function world(status = "PUBLISHED") {
        const row: any = ev({ status }); const uploads: any[] = [], audits: any[] = [];
        const eventRepository: any = { listRemindersFor: async () => [], findById: async () => row, update: async (_id: string, w: any) => Object.assign(row, w.data) };
        const deps: any = { eventRepository, eventMapper: new EventMapper(), auditService: { log: async (p: any) => { audits.push(p); } }, eventCoverBucket: "pub", storageService: { upload: async (o: any) => { uploads.push(o); return { url: "https://cdn/x.png" }; } } };
        return { row, uploads, audits, up: new UploadEventCoverUseCase(deps), rm: new RemoveEventCoverUseCase(deps) };
    }
    it("a real image is stored under the school's events folder and the url saved; removing clears it", async () => {
        const w = world();
        const out = await w.up.execute("s1", "e1", { buffer: png }, "u1", all);
        assert.equal(out.coverImageUrl, "https://cdn/x.png"); assert.equal(w.uploads[0].folder, "schools/s1/events"); assert.equal(w.uploads[0].mimetype, "image/png");
        assert.equal(w.audits[0].action, "calendar_event.cover_changed");
        assert.equal((await w.rm.execute("s1", "e1", "u1", all)).coverImageUrl, null);
        assert.equal(w.audits[1].action, "calendar_event.cover_removed");
    });
    it("not an image, too big, SVG-like text, cancelled event or out-of-scope person: refused and nothing stored", async () => {
        const w = world();
        await assert.rejects(w.up.execute("s1", "e1", { buffer: Buffer.from("<svg onload=alert(1)>") }, "u1", all), { code: "EVENT_INVALID_IMAGE" });
        await assert.rejects(w.up.execute("s1", "e1", { buffer: Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]) }, "u1", all), { code: "EVENT_INVALID_IMAGE" });
        await assert.rejects(w.up.execute("s1", "e1", { buffer: png }, "u1", { can: () => false, scopeOf: () => "ALL", branchScope: () => [] } as any), { code: "EVENT_OUT_OF_SCOPE" });
        await assert.rejects(world("CANCELLED").up.execute("s1", "e1", { buffer: png }, "u1", all), { code: "EVENT_CANCELLED" });
        assert.equal(w.uploads.length, 0);
    });
});
