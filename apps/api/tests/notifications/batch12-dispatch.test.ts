/*
| REM-094 nobody reachable · REM-098 header + recipients atomic · REM-101 subject length (all over the real send/dispatch services).
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notificationsWorld, code } from "./support/notifications-world";
import { NotificationDispatchService } from "../../src/modules/notifications/services/notification-dispatch.service";
import { renderMessage, renderPlain, finishSubject, SUBJECT_MAX } from "../../src/modules/message-templates/domain/template-engine";

const dto = (o: any = {}) => ({ type: "broadcast", title: "Hello", message: "Body", targetType: "GUARDIAN", guardianIds: ["g2"], channels: ["SMS"], ...o });

describe("REM-094: an announcement nobody can receive", () => {
    it("is refused with NO_DELIVERABLE_RECIPIENTS and creates nothing (g2 has no phone)", async () => {
        const w = notificationsWorld();
        await assert.rejects(w.send.execute(dto() as any, "sch", "u1"), code("NO_DELIVERABLE_RECIPIENTS"));
        assert.equal(w.notifications.length, 0); assert.equal(w.rows.length, 0); assert.equal(w.audit.length, 0);
    });
    it("the message says how many were left out", async () => {
        const w = notificationsWorld();
        await assert.rejects(w.send.execute(dto() as any, "sch", "u1"), (e: any) => /1 recipient/.test(e.message) && /1 missing an email address or phone number/.test(e.message));
    });
    it("when some people can be reached it still sends and reports how many were skipped", async () => {
        const w = notificationsWorld();
        const out: any = await w.send.execute(dto({ guardianIds: ["g1", "g2"] }) as any, "sch", "u1");
        assert.equal(out.recipients, 2); assert.equal(out.byChannel.SMS, 1); assert.equal(out.skippedNoContact, 1);
        assert.equal(w.audit[0].newValue.skippedNoContact, 1);
    });
    it("in-app needs no contact details, so the same audience is fine on IN_APP", async () => {
        const w = notificationsWorld(); const out: any = await w.send.execute(dto({ channels: ["IN_APP"] }) as any, "sch", "u1"); assert.equal(out.skippedNoContact, 0);
    });
});

describe("REM-098: the notification and its recipients are written together", () => {
    function make(failOnChunk: boolean, transactional: boolean) {
        const w: any = notificationsWorld();
        const real = w.repo.createSchoolRecipientsBatch.bind(w.repo);
        w.repo.createSchoolRecipientsBatch = async (b: any[]) => { await real(b.slice(0, 1)); if (failOnChunk) throw new Error("chunk 2 failed"); return real(b.slice(1)); };   // part of the audience is written, then it fails
        const tx = async <T>(fn: () => Promise<T>) => {                                  // snapshot-rollback transaction over the fake tables
            const n = w.notifications.length, r = w.rows.length;
            try { return await fn(); } catch (e) { w.notifications.length = n; w.rows.length = r; throw e; }
        };
        const dispatch = new NotificationDispatchService({ notificationRepository: w.repo, notificationDeliveryQueue: { async enqueue() {} }, tenantInfo: () => ({ schoolId: "s", tenantSchema: "t" }), transaction: transactional ? tx : (fn => fn()) });
        const msgs = ["a", "b", "c"].map(id => ({ type: "broadcast", channel: "IN_APP" as const, title: "T", message: "M", recipient: { recipientType: "GUARDIAN" as const, recipientEntityId: id } }));
        return { w, run: () => dispatch.dispatch({ sentById: "u", targetType: "EVERYONE", messages: msgs }) };
    }
    it("a failure part-way leaves NO notification and NO recipient rows", async () => {
        const { w, run } = make(true, true);
        await assert.rejects(run(), /chunk 2 failed/); assert.equal(w.notifications.length, 0); assert.equal(w.rows.length, 0);
    });
    it("control: without the transaction the header and part of the audience stay behind (the bug)", async () => {
        const { w, run } = make(true, false);
        await assert.rejects(run(), /chunk 2 failed/); assert.equal(w.notifications.length, 1); assert.equal(w.rows.length, 1);
    });
    it("a successful dispatch still creates everything and queues after the commit", async () => {
        const { w, run } = make(false, true); await run(); assert.equal(w.rows.length, 3); assert.equal(w.notifications.length, 1);
    });
    it("production wiring: the default runs in withTenantTransaction and creates header + rows inside it", () => {
        const { readFileSync } = require("node:fs"); const s = readFileSync(new URL("../../src/modules/notifications/services/notification-dispatch.service.ts", import.meta.url), "utf8");
        assert.match(s, /withTenantTransaction/);
        assert.ok(s.indexOf("this.run(async") < s.indexOf("createSchoolNotification(") && s.indexOf("createSchoolNotification(") < s.indexOf("createSchoolRecipientsBatch(") && s.indexOf("createSchoolRecipientsBatch(") < s.indexOf("toQueue.push"));
    });
});

describe("REM-101: rendered subjects are one line and at most 120 characters", () => {
    const long = "x".repeat(200);
    const t = { subject: "Fee reminder for {{student_name}}", body: "Hi" };
    it("a long value cannot push the subject past the limit (email and plain)", () => {
        const e = renderMessage("EMAIL", t, { student_name: long }); const p = renderPlain(t, { student_name: long });
        for (const s of [e.subject!, p.subject!]) { assert.ok([...s].length <= SUBJECT_MAX); assert.ok(s.endsWith("…")); assert.ok(s.startsWith("Fee reminder for xxx")); }
        assert.equal(e.subject, p.subject, "deterministic: the same cut every time");
    });
    it("a subject that fits is untouched; exactly 120 characters is kept", () => {
        assert.equal(renderMessage("EMAIL", t, { student_name: "Ada" }).subject, "Fee reminder for Ada");
        const exact = "y".repeat(SUBJECT_MAX); assert.equal(finishSubject(exact), exact); assert.equal([...finishSubject(exact + "z")].length, SUBJECT_MAX);
    });
    it("line breaks from a value cannot split the subject line (header injection)", () => {
        const s = renderMessage("EMAIL", t, { student_name: "Ada\r\nBcc: evil@x.com" }).subject!;
        assert.doesNotMatch(s, /[\r\n]/);
    });
    it("emoji and other multi-unit characters are cut on character boundaries", () => {
        const s = finishSubject("😀".repeat(200)); assert.equal([...s].length, SUBJECT_MAX); assert.doesNotMatch(s, /[\uD800-\uDBFF]$/);
    });
    it("SMS has no subject", () => assert.equal(renderMessage("SMS", t, { student_name: "Ada" }).subject, null));
});
