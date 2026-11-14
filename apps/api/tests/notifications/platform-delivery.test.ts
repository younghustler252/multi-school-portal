import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotificationDeliveryService } from "../../src/modules/notifications/services/notification-delivery.service";

/* A platform notice reaches a school through the school's ADMIN, found from the school's memberships (SchoolAdminDirectory). */
function build(contact: { email: string; phone: string | null; firstName: string | null } | null, channel: "EMAIL" | "SMS" = "EMAIL", fail = false) {
    const marks: string[] = []; const sent: any[] = []; const asked: string[] = [];
    const repo: any = {
        findPlatformRecipientById: async () => ({ id: "r1", status: "PENDING", notificationId: "n1", schoolId: "sch-9", channel }),
        findPlatformNotificationById: async () => ({ id: "n1", title: "Maintenance tonight", message: "Short downtime at 10pm", type: "maintenance" }),
        settlePlatformNotification: async (id: string) => { marks.push(`settle:${id}`); return true; },
        markPlatformRecipientRetrying: async (_id: string, why: string) => { marks.push(`retrying:${why}`); },
        markPlatformRecipientSent: async () => { marks.push("sent"); },
        markPlatformRecipientFailed: async (_id: string, why: string) => { marks.push(`failed:${why}`); },
    };
    const svc = new NotificationDeliveryService({
        notificationRepository: repo, studentRepository: {} as any, guardianRepository: {} as any, staffRepository: {} as any, userRepository: {} as any,
        channelRegistry: { get: () => ({ send: async (p: any) => { sent.push(p); return fail ? { success: false, error: "provider down" } : { success: true, providerMessageId: "m1" }; } }) } as any,
        schoolAdminDirectory: { firstContactOf: async (id: string) => { asked.push(id); return contact; } } as any,
    });
    return { svc, marks, sent, asked };
}

describe("platform notice delivery", () => {
    it("goes to the school's admin found for that school, by email", async () => {
        const w = build({ email: "ada@school.ng", phone: "0801", firstName: "Ada" });
        assert.deepEqual(await w.svc.deliverPlatformRecipient("r1"), { outcome: "sent" });
        assert.deepEqual(w.asked, ["sch-9"]); assert.equal(w.sent[0].to, "ada@school.ng"); assert.equal(w.sent[0].metadata.firstName, "Ada");
        assert.deepEqual(w.marks, ["sent", "settle:n1"]);
    });
    it("an SMS notice uses the admin's phone", async () => {
        const w = build({ email: "ada@school.ng", phone: "0801", firstName: "Ada" }, "SMS");
        await w.svc.deliverPlatformRecipient("r1");
        assert.equal(w.sent[0].to, "0801");
    });
    it("a school with no admin contact is marked undeliverable with a clear reason, and nothing is sent", async () => {
        const w = build(null);
        const r: any = await w.svc.deliverPlatformRecipient("r1");
        assert.equal(r.outcome, "undeliverable"); assert.equal(r.reason, "No school admin contact on file");
        assert.equal(w.sent.length, 0); assert.deepEqual(w.marks, ["failed:No school admin contact on file", "settle:n1"]);
    });
    it("REM-093/097: a failed try that the queue will repeat keeps the row QUEUED and the parent OPEN; the last try marks it FAILED and settles", async () => {
        const mid = build({ email: "ada@school.ng", phone: null, firstName: null }, "EMAIL", true);
        assert.equal(((await mid.svc.deliverPlatformRecipient("r1", { finalAttempt: false })) as any).outcome, "failed");
        assert.deepEqual(mid.marks, ["retrying:provider down"]);                       // no FAILED, no settle: the parent stays PROCESSING
        const last = build({ email: "ada@school.ng", phone: null, firstName: null }, "EMAIL", true);
        await last.svc.deliverPlatformRecipient("r1", { finalAttempt: true });
        assert.deepEqual(last.marks, ["failed:provider down", "settle:n1"]);
    });
    it("a missing contact is final at once even on an early try (retrying cannot help), and settles", async () => {
        const w = build(null);
        await w.svc.deliverPlatformRecipient("r1", { finalAttempt: false });
        assert.deepEqual(w.marks, ["failed:No school admin contact on file", "settle:n1"]);
    });
});
