/* REM-095: an empty school selection never turns into a broadcast to every school. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SendPlatformNotificationUseCase } from "../../src/modules/notifications/usecases/send-platform-notification.usecase";

const UUID_A = "00000000-0000-4000-8000-00000000000a", UUID_B = "00000000-0000-4000-8000-00000000000b";
function world() {
    const created: any[] = [], recipients: any[] = [], mails: string[] = [], jobs: any[] = [], states: any[] = [];
    const notes = new Map<string, any>();
    const deps: any = {
        notificationRepository: {
            createPlatformNotification: async (d: any) => {
                const id = d.id ?? `n${notes.size + 1}`;
                if (notes.has(id)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
                const row = { sentAt: null, completedAt: null, ...d, id }; notes.set(id, row); created.push(row); return { ...row };
            },
            ensurePlatformRecipients: async (rows: any[]) => {
                for (const r of rows) if (!recipients.some(x => x.notificationId === r.notificationId && x.schoolId === r.schoolId && x.channel === r.channel)) recipients.push({ id: `r${recipients.length + 1}`, ...r });
                return recipients.filter(x => x.notificationId === rows[0].notificationId);
            },
            markPlatformRecipientsQueued: async (ids: string[]) => { for (const r of recipients) if (ids.includes(r.id) && r.status === "PENDING") r.status = "QUEUED"; },
            findPlatformNotificationById: async (id: string) => (notes.has(id) ? { ...notes.get(id) } : null),
            updatePlatformNotification: async (id: string, d: any) => { states.push(d); Object.assign(notes.get(id), d); return { ...notes.get(id) }; },
        },
        platformNotificationMapper: { toResponse: (x: any) => x },
        schoolRepository: { findMany: async () => [{ id: "s1" }, { id: "s2" }, { id: "s3" }] },
        notificationDeliveryQueue: { enqueue: async (j: any[]) => { if ((deps as any).queueDown) throw new Error("redis down"); jobs.push(...j); } },
    };
    const base = { title: "t", message: "m", type: "system_alert", channels: ["IN_APP", "EMAIL"] } as any;
    return { uc: new SendPlatformNotificationUseCase(deps), deps, notes, created, recipients, mails, jobs, states, base };
}
const schoolsOf = (w: ReturnType<typeof world>) => [...new Set(w.recipients.map(r => r.schoolId))].sort();

describe("platform notification targeting", () => {
    it("schoolIds: [] is refused and NOTHING is saved or sent (the bug broadcast it to every active school)", async () => {
        const w = world();
        await assert.rejects(w.uc.execute({ ...w.base, schoolIds: [] }, "admin"), { statusCode: 400 });
        assert.equal(w.created.length, 0); assert.equal(w.recipients.length, 0); assert.equal(w.mails.length, 0);
    });
    it("chosen schools get it, once each (duplicates collapse), and only they", async () => {
        const w = world();
        await w.uc.execute({ ...w.base, schoolIds: ["s2", "s2", "s1"] }, "admin");
        assert.deepEqual(schoolsOf(w), ["s1", "s2"]); assert.equal(w.recipients.length, 4);   // 2 schools x 2 channels
        assert.deepEqual(w.jobs.map(j => j.recipientId).sort(), ["r2", "r4"]);              // the two EMAIL rows are queued, not mailed inline
    });
    it("REM-093: in-app rows are SENT, email rows go to the queue as platform jobs, and the parent is PROCESSING, not COMPLETED", async () => {
        const w = world();
        const out: any = await w.uc.execute({ ...w.base, schoolIds: ["s1"] }, "admin");
        assert.deepEqual(w.recipients.map(r => [r.channel, r.status]), [["IN_APP", "SENT"], ["EMAIL", "QUEUED"]]);
        assert.deepEqual(w.jobs.map(j => j.kind), ["platform"]);
        assert.equal(out.state, "PROCESSING"); assert.equal(out.completedAt, null);
    });
    it("REM-093: an in-app-only notice has nothing to wait for and completes at once", async () => {
        const w = world();
        const out: any = await w.uc.execute({ ...w.base, channels: ["IN_APP"], schoolIds: ["s1"] }, "admin");
        assert.equal(w.jobs.length, 0); assert.equal(out.state, "COMPLETED");
    });
    it("REM-093: if the queue is down the rows stay PENDING and the parent is QUEUED, never falsely COMPLETED", async () => {
        const w = world(); (w.deps as any).queueDown = true;
        const out: any = await w.uc.execute({ ...w.base, schoolIds: ["s1"] }, "admin");
        assert.equal(w.recipients.find(r => r.channel === "EMAIL").status, "PENDING");
        assert.equal(out.state, "QUEUED");
    });
    it("REM-097: the same idempotencyKey returns the ORIGINAL broadcast and sends nothing twice", async () => {
        const w = world();
        const first: any = await w.uc.execute({ ...w.base, schoolIds: ["s1", "s2"], idempotencyKey: "retry-key-001" }, "admin");
        const jobsAfterFirst = w.jobs.length;
        const again: any = await w.uc.execute({ ...w.base, schoolIds: ["s1", "s2"], idempotencyKey: "retry-key-001" }, "admin");
        assert.equal(again.id, first.id); assert.equal(w.created.length, 1);
        assert.equal(w.recipients.length, 4);                                     // no second set of rows
        assert.equal(w.jobs.length, jobsAfterFirst * 2);                          // QUEUED rows are handed over again, but the job id is the row id, so the queue drops the repeat
        assert.deepEqual(w.jobs.slice(0, jobsAfterFirst).map(j => j.recipientId), w.jobs.slice(jobsAfterFirst).map(j => j.recipientId));
    });
    it("REM-097: a different operator or key makes a different broadcast; the same key with a different message is refused", async () => {
        const w = world();
        const a: any = await w.uc.execute({ ...w.base, schoolIds: ["s1"], idempotencyKey: "retry-key-001" }, "admin");
        const b: any = await w.uc.execute({ ...w.base, schoolIds: ["s1"], idempotencyKey: "retry-key-002" }, "admin");
        const c: any = await w.uc.execute({ ...w.base, schoolIds: ["s1"], idempotencyKey: "retry-key-001" }, "other-admin");
        assert.equal(new Set([a.id, b.id, c.id]).size, 3);
        await assert.rejects(w.uc.execute({ ...w.base, message: "changed", schoolIds: ["s1"], idempotencyKey: "retry-key-001" }, "admin"), { statusCode: 400 });
    });
    it("REM-097: a send that failed at the queue resumes: only still-pending rows are handed over, delivered rows are untouched", async () => {
        const w = world();
        const dto = { ...w.base, schoolIds: ["s1", "s2"], idempotencyKey: "resume-key-01" };
        (w.deps as any).queueDown = true;
        const first: any = await w.uc.execute(dto, "admin");
        assert.equal(first.state, "QUEUED"); assert.equal(w.jobs.length, 0);
        // a worker (or an earlier partial run) already delivered school s1's email
        w.recipients.find(r => r.schoolId === "s1" && r.channel === "EMAIL").status = "SENT";
        (w.deps as any).queueDown = false;
        const resumed: any = await w.uc.execute(dto, "admin");
        assert.equal(resumed.id, first.id); assert.equal(w.recipients.length, 4);
        assert.deepEqual(w.jobs.map(j => j.recipientId), [w.recipients.find(r => r.schoolId === "s2" && r.channel === "EMAIL").id]);   // s1's SENT email is not resent
        assert.equal(w.recipients.find(r => r.schoolId === "s1" && r.channel === "EMAIL").status, "SENT");
        assert.equal(resumed.state, "PROCESSING");
    });
    it("REM-097: two requests with one key at the same moment make ONE broadcast (the loser resumes the winner's row)", async () => {
        const w = world();
        const [x, y]: any[] = await Promise.all([1, 2].map(() => w.uc.execute({ ...w.base, schoolIds: ["s1"], idempotencyKey: "race-key-0001" }, "admin")));
        assert.equal(x.id, y.id); assert.equal(w.created.length, 1); assert.equal(w.recipients.length, 2);
    });
    it("broadcastAll: true reaches every active school", async () => {
        const w = world();
        await w.uc.execute({ ...w.base, broadcastAll: true }, "admin");
        assert.deepEqual(schoolsOf(w), ["s1", "s2", "s3"]);
    });
    it("legacy compatibility: no target at all is still a broadcast (until the web app sends broadcastAll)", async () => {
        const w = world();
        await w.uc.execute(w.base, "admin");
        assert.deepEqual(schoolsOf(w), ["s1", "s2", "s3"]);
    });
    it("REM-095 strict switch: with PLATFORM_BROADCAST_STRICT=true an implicit all-schools send is refused BEFORE anything is saved; explicit forms still work", async () => {
        const prev = process.env.PLATFORM_BROADCAST_STRICT; process.env.PLATFORM_BROADCAST_STRICT = "true";
        try {
            const w = world();
            await assert.rejects(w.uc.execute(w.base, "admin"), { statusCode: 400 });
            assert.equal(w.created.length, 0); assert.equal(w.recipients.length, 0);
            await w.uc.execute({ ...w.base, broadcastAll: true }, "admin");
            assert.deepEqual(schoolsOf(w), ["s1", "s2", "s3"]);
            const w2 = world(); await w2.uc.execute({ ...w2.base, schoolIds: ["s1"] }, "admin");
            assert.deepEqual(schoolsOf(w2), ["s1"]);
        } finally { if (prev === undefined) delete process.env.PLATFORM_BROADCAST_STRICT; else process.env.PLATFORM_BROADCAST_STRICT = prev; }
    });
    it("REM-095 legacy mode: the implicit send still works (web composer today) but is marked on the notification, and explicit sends are not marked", async () => {
        const w = world();
        const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
        try {
            await w.uc.execute(w.base, "admin");
            assert.equal(w.created[0].metadata.implicitBroadcast, true); assert.equal(warned, 1);
            const w2 = world(); await w2.uc.execute({ ...w2.base, broadcastAll: true }, "admin");
            assert.equal(w2.created[0].metadata?.implicitBroadcast, undefined); assert.equal(warned, 1);
        } finally { console.warn = warn; }
    });
    it("contradictory intent is refused: schoolIds with broadcastAll: true, or broadcastAll: false with no schools", async () => {
        const w = world();
        await assert.rejects(w.uc.execute({ ...w.base, schoolIds: ["s1"], broadcastAll: true }, "admin"), { statusCode: 400 });
        await assert.rejects(w.uc.execute({ ...w.base, broadcastAll: false }, "admin"), { statusCode: 400 });
        assert.equal(w.created.length, 0);
    });
    it("the DTO refuses an empty list, both fields together and broadcastAll: false alone (needs zod)", async t => {
        let Dto: any;
        try { Dto = (await import("../../src/modules/notifications/dtos/notification.dto")).SendPlatformNotificationDto; } catch { return t.skip("zod is not installed here"); }
        const ok = { title: "t", message: "m", type: "system_alert", channels: ["IN_APP"] };
        assert.equal(Dto.safeParse({ ...ok, schoolIds: [] }).success, false);
        assert.equal(Dto.safeParse({ ...ok, schoolIds: [UUID_A], broadcastAll: true }).success, false);
        assert.equal(Dto.safeParse({ ...ok, broadcastAll: false }).success, false);
        assert.equal(Dto.safeParse({ ...ok, schoolIds: [UUID_A, UUID_B] }).success, true);
        assert.equal(Dto.safeParse({ ...ok, broadcastAll: true }).success, true);
        assert.equal(Dto.safeParse(ok).success, true);                       // legacy: omitted target
    });
});
