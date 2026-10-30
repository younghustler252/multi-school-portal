import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notificationsWorld, code } from "./support/notifications-world";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { SendSchoolNotificationDto } from "../../src/modules/notifications/dtos/notification.dto";
import { GetMyNotificationsUseCase, MarkNotificationReadUseCase, MarkAllNotificationsReadUseCase } from "../../src/modules/notifications/usecases/my-notifications.usecases";
import { EmailNotificationChannel } from "../../src/infrastructure/notifications/providers/email.channel";

const msg = (over: any = {}) => ({
    type: "fee_reminder", channel: "EMAIL", title: "Fee reminder", message: "Pay please",
    recipient: { recipientType: "GUARDIAN", recipientEntityId: "g1" }, ...over,
});

describe("dispatch: one road for every message", () => {
    it("in-app rows are visible at once; email and SMS rows are queued", async () => {
        const w = notificationsWorld();
        const r = await w.dispatch.dispatch({ sentById: "u", targetType: "GUARDIAN", messages: [msg({ channel: "IN_APP" }), msg({ channel: "EMAIL" }), msg({ channel: "SMS" })] });
        assert.equal(r.created, 3);
        assert.equal(r.queued, 2);
        assert.equal(w.rows.find(x => x.channel === "IN_APP")!.status, "SENT");
        assert.deepEqual(w.rows.filter(x => x.channel !== "IN_APP").map(x => x.status), ["QUEUED", "QUEUED"]);
        assert.deepEqual(w.queued.map(j => [j.kind, j.schoolId, j.tenantSchema]).flat().filter((v, i) => i < 3), ["school", "sch", "school_sch"]);
    });
    it("the same words share ONE notification; different words get their own", async () => {
        const w = notificationsWorld();
        await w.dispatch.dispatch({ sentById: "u", targetType: "ALL_PARENTS", messages: [
            msg({ recipient: { recipientType: "GUARDIAN", recipientEntityId: "g1" } }), msg({ recipient: { recipientType: "GUARDIAN", recipientEntityId: "g2" } }),
            msg({ message: "Different", recipient: { recipientType: "GUARDIAN", recipientEntityId: "g1" } }),
        ] });
        assert.equal(w.notifications.length, 2);
        assert.equal(w.rows.length, 3);
    });
    it("an idempotency key makes a repeat do nothing, in one call and across calls", async () => {
        const w = notificationsWorld();
        const a = await w.dispatch.dispatch({ sentById: "u", targetType: "GUARDIAN", messages: [msg({ idempotencyKey: "k1" }), msg({ idempotencyKey: "k1" })] });
        assert.equal(a.created, 1); assert.equal(a.duplicates, 1);
        const b = await w.dispatch.dispatch({ sentById: "u", targetType: "GUARDIAN", messages: [msg({ idempotencyKey: "k1" })] });
        assert.equal(b.created, 0); assert.equal(b.duplicates, 1);
        assert.equal(w.notifications.length, 1, "no empty notification is left behind");
        assert.equal(w.queued.length, 1, "queued once");
    });
    it("when the queue is down the rows stay PENDING (never lost); requeueStale sends them once it is back", async () => {
        const w = notificationsWorld({ queueDown: true });
        const r = await w.dispatch.dispatch({ sentById: "u", targetType: "GUARDIAN", messages: [msg()] });
        assert.equal(r.created, 1); assert.equal(r.queued, 0);
        assert.equal(w.rows[0].status, "PENDING");
        const working = notificationsWorld();
        working.rows.push({ ...w.rows[0], updatedAt: new Date("2026-10-30T07:00:00Z") });
        assert.equal(await working.dispatch.requeueStale(10 * 60 * 1000), 1);
        assert.equal(working.queued.length, 1);
        assert.equal(await working.dispatch.requeueStale(10 * 60 * 1000), 0, "now QUEUED with a fresh stamp: not picked again");
    });
});

describe("delivery: what happens to one email or SMS", () => {
    it("sends, marks SENT, and a second delivery of the same row does nothing", async () => {
        const w = notificationsWorld();
        await w.dispatch.dispatch({ sentById: "u", targetType: "GUARDIAN", messages: [msg()] });
        const id = w.rows[0].id;
        assert.equal((await w.delivery.deliverSchoolRecipient(id)).outcome, "sent");
        assert.equal(w.rows[0].status, "SENT");
        assert.equal(w.sent[0].to, "ada@x.ng");
        assert.equal(w.sent[0].metadata.firstName, "Ada");
        assert.equal((await w.delivery.deliverSchoolRecipient(id)).outcome, "skipped");
        assert.equal(w.sent.length, 1, "never sent twice");
    });
    it("no contact on file is undeliverable (recorded, not retried); a provider failure is failed (retried)", async () => {
        const w = notificationsWorld();
        await w.dispatch.dispatch({ sentById: "u", targetType: "GUARDIAN", messages: [msg({ channel: "SMS", recipient: { recipientType: "GUARDIAN", recipientEntityId: "g2" } }), msg()] });
        const [noPhone, ok] = w.rows;
        const a = await w.delivery.deliverSchoolRecipient(noPhone.id);
        assert.equal(a.outcome, "undeliverable"); assert.match(a.reason!, /No sms contact/);
        assert.equal(noPhone.status, "FAILED");
        w.failChannels("provider down");
        const b = await w.delivery.deliverSchoolRecipient(ok.id);
        assert.equal(b.outcome, "failed"); assert.equal(ok.failedReason, "provider down");
        w.failChannels(null);
        assert.equal((await w.delivery.deliverSchoolRecipient(ok.id)).outcome, "sent", "a retry after a failure goes through");
    });
    it("students and staff are reached through their user account", async () => {
        const w = notificationsWorld();
        await w.dispatch.dispatch({ sentById: "u", targetType: "EVERYONE", messages: [
            msg({ recipient: { recipientType: "STUDENT", recipientEntityId: "s1" } }), msg({ channel: "SMS", recipient: { recipientType: "STAFF", recipientEntityId: "t1" } })] });
        for (const r of [...w.rows]) await w.delivery.deliverSchoolRecipient(r.id);
        assert.deepEqual(w.sent.map(s => s.to).sort(), ["0804", "tolu@x.ng"]);
    });
});

describe("email channel: nothing a person typed can inject markup", () => {
    it("escapes the title, the greeting name and the message", async () => {
        const letters: any[] = [];
        const ch = new EmailNotificationChannel({ async sendLetter(_to: string, p: any) { letters.push(p); } } as any);
        await ch.send({ recipientId: "r", to: "a@b.ng", title: "<b>Hi</b>\nthere", message: "<script>alert(1)</script>\n\nSecond", type: "x", metadata: { firstName: "<i>Ada</i>" } });
        const l = letters[0];
        assert.equal(l.subject, "<b>Hi</b> there", "subject is plain, one line");
        assert.ok(!l.title.includes("<b>") && l.title.includes("&lt;b&gt;"));
        assert.ok(!l.greeting.includes("<i>"));
        assert.ok(!l.paragraphs.join("").includes("<script>"));
        assert.equal(l.paragraphs.length, 2);
    });
    it("a message that greets by name skips the generic greeting", async () => {
        const letters: any[] = [];
        const ch = new EmailNotificationChannel({ async sendLetter(_to: string, p: any) { letters.push(p); } } as any);
        await ch.send({ recipientId: "r", to: "a@b.ng", title: "T", message: "Hi Ada,\n\nbody", type: "x", metadata: { skipGreeting: true } });
        assert.equal(letters[0].greeting, undefined);
    });
});

describe("sending an announcement", () => {
    const dto = (over: any = {}) => ({ title: "School closed", message: "Monday is a holiday", type: "holiday", targetType: "ALL_PARENTS", channels: ["IN_APP", "EMAIL"], includeGraduates: false, ...over });

    it("creates one row per person and channel, skips a missing email, and audits", async () => {
        const w = notificationsWorld();
        const out = await w.send.execute(dto() as any, "sch", "u1");
        assert.equal(out.recipients, 2);
        assert.equal(w.rows.filter(r => r.channel === "IN_APP").length, 2);
        assert.equal(w.rows.filter(r => r.channel === "EMAIL").length, 2);
        const sms = await w.send.execute(dto({ channels: ["SMS"], message: "x" }) as any, "sch", "u1");
        assert.equal(w.rows.filter(r => r.channel === "SMS").length, 1, "g2 has no phone, so no SMS row");
        assert.equal(sms.recipients, 2);
        assert.equal(w.audit[0].action, "notifications.sent");
        assert.equal(w.notifications[0].metadata.source, "manual");
    });
    it("a channel the plan does not include, or the school switched off, is refused with the reason", async () => {
        const noPlan = notificationsWorld({ plan: { sms: false } });
        await assert.rejects(noPlan.send.execute(dto({ channels: ["SMS"] }) as any, "sch", "u1"), (e: any) => e.code === "CHANNEL_NOT_AVAILABLE" && e.details.channels[0].reason === "plan");
        const off = notificationsWorld({ prefs: { "notifications.email_enabled": false } });
        await assert.rejects(off.send.execute(dto({ channels: ["IN_APP", "EMAIL"] }) as any, "sch", "u1"), (e: any) => e.details.channels[0].reason === "school_setting");
        assert.equal(off.rows.length, 0, "nothing was created");
        const inApp = await off.send.execute(dto({ channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.equal(inApp.recipients, 2, "in-app is always allowed");
    });
    it("SMS is OFF by default for a school that never touched its settings", async () => {
        const w = notificationsWorld({ prefs: { "notifications.sms_enabled": false } });
        await assert.rejects(w.send.execute(dto({ channels: ["SMS"] }) as any, "sch", "u1"), code("CHANNEL_NOT_AVAILABLE"));
    });
    it("nobody to send to is a clear error", async () => {
        const w = notificationsWorld();
        await assert.rejects(w.send.execute(dto({ targetType: "GUARDIAN", guardianIds: ["nobody"] }) as any, "sch", "u1"), code("NO_RECIPIENTS"));
    });
    it("request validation: system message types, long titles, extra fields and huge lists are refused", () => {
        assert.ok(SendSchoolNotificationDto.safeParse(dto()).success);
        assert.equal(SendSchoolNotificationDto.safeParse(dto({ type: "fee_receipt" })).success, false, "receipts are system messages");
        assert.equal(SendSchoolNotificationDto.safeParse(dto({ title: "a\nb" })).success, false);
        assert.equal(SendSchoolNotificationDto.safeParse(dto({ message: "x".repeat(2001) })).success, false);
        assert.equal(SendSchoolNotificationDto.safeParse(dto({ sneaky: 1 })).success, false);
        assert.equal(SendSchoolNotificationDto.safeParse(dto({ guardianIds: Array(501).fill("0b9d3a3e-5b1c-4e55-9f6a-0a1b2c3d4e5f") })).success, false);
    });
});

describe("my inbox", () => {
    it("shows only my in-app messages; marking someone else's message read is a 404 and changes nothing", async () => {
        const w = notificationsWorld();
        await w.dispatch.dispatch({ sentById: "u", targetType: "ALL_PARENTS", messages: [
            msg({ channel: "IN_APP", recipient: { recipientType: "GUARDIAN", recipientEntityId: "g1" } }),
            msg({ channel: "IN_APP", recipient: { recipientType: "GUARDIAN", recipientEntityId: "g2" } }),
            msg({ channel: "EMAIL", recipient: { recipientType: "GUARDIAN", recipientEntityId: "g1" } })] });
        const d = { notificationRepository: w.repo };
        const g1 = { persona: "GUARDIAN" as const, personaEntityId: "g1" };
        const g2Row = w.rows.find(r => r.recipientEntityId === "g2")!;
        assert.equal((await new GetMyNotificationsUseCase(d).execute(g1, {})).data.length, 1, "the email copy is not in the inbox");
        await assert.rejects(new MarkNotificationReadUseCase(d).execute(g1, g2Row.id), code("NOTIFICATION_NOT_FOUND"));
        assert.equal(g2Row.readAt, null);
        await new MarkNotificationReadUseCase(d).execute(g1, w.rows.find(r => r.recipientEntityId === "g1" && r.channel === "IN_APP")!.id);
        assert.deepEqual(await new MarkAllNotificationsReadUseCase(d).execute(g1), { marked: 0 });
    });
    it("a staff member and a guardian with the same record id never see each other's messages", async () => {
        const w = notificationsWorld();
        await w.dispatch.dispatch({ sentById: "u", targetType: "EVERYONE", messages: [msg({ channel: "IN_APP", recipient: { recipientType: "STAFF", recipientEntityId: "g1" } })] });
        const d = { notificationRepository: w.repo };
        assert.equal((await new GetMyNotificationsUseCase(d).execute({ persona: "GUARDIAN", personaEntityId: "g1" }, {})).data.length, 0);
        assert.equal((await new GetMyNotificationsUseCase(d).execute({ persona: "STAFF", personaEntityId: "g1" }, {})).data.length, 1);
    });
    it("an account with no persona has no inbox", async () => {
        const w = notificationsWorld();
        await assert.rejects(new GetMyNotificationsUseCase({ notificationRepository: w.repo }).execute({ persona: null, personaEntityId: null }, {}), code("NO_INBOX"));
    });
});

describe("notifications: permissions and wiring", () => {
    it("registry valid; keys under their own module; principal sends, nobody else by default", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        const mine = PERMISSION_REGISTRY.filter(p => p.module === "notifications");
        assert.deepEqual(mine.map(p => p.key).sort(), ["notifications.platform.view", "notifications.send", "notifications.view"]);
        assert.equal(mine.find(p => p.key === "notifications.send")!.isSensitive, true);
        const granted = (k: string) => ROLE_TEMPLATES.find(r => r.key === k)!.permissions.map(p => p.key);
        assert.ok(granted("principal").includes("notifications.send"));
        for (const k of ["teacher", "bursar", "branch_principal", "student", "guardian"]) assert.ok(!granted(k).some(x => x.startsWith("notifications.")), k);
    });
    it("every school route has a permission or the inbox persona guard; the platform routes keep the super admin guard; mounted and registered", () => {
        const strip = (f: string) => readFileSync(f, "utf8").split("\n").filter(l => !l.trim().startsWith("//") && !l.trim().startsWith("|")).join("\n");
        const routes = strip("src/modules/notifications/routes/notification.routes.ts").split("\n").filter(l => /^router\.(get|post|patch)\(/.test(l));
        assert.equal(routes.length, 9);
        for (const l of routes) assert.match(l, /\.\.\.guard\(|\.\.\.mine|requireSuperAdmin/, l);
        assert.ok(!/requireSchoolAdmin/.test(strip("src/modules/notifications/routes/notification.routes.ts")));
        assert.ok(routes.findIndex(l => l.includes('"/me/read-all"')) < routes.findIndex(l => l.includes('"/me/:recipientId/read"')), "fixed path before the id path");
        assert.match(strip("src/routes/index.ts"), /router\.use\("\/notifications",\s*notificationRouter\)/);
        assert.match(strip("src/container/index.ts"), /registerNotifications,/);
    });
    it("the worker listens on the notification queue (it used to be a copy of the payment worker)", () => {
        const src = readFileSync("src/infrastructure/jobs/workers/notification.worker.ts", "utf8");
        assert.match(src, /new Worker<NotificationDeliveryJob>\(\s*"notification"/);
        assert.ok(!/payment/i.test(src.replace(/payment worker|payment reconciliation worker/gi, "")));
    });
});
