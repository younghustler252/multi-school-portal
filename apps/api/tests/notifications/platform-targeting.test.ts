/* REM-095: an empty school selection never turns into a broadcast to every school. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SendPlatformNotificationUseCase } from "../../src/modules/notifications/usecases/send-platform-notification.usecase";

const UUID_A = "00000000-0000-4000-8000-00000000000a", UUID_B = "00000000-0000-4000-8000-00000000000b";
function world() {
    const created: any[] = [], recipients: any[] = [], mails: string[] = [];
    const deps: any = {
        notificationRepository: {
            createPlatformNotification: async (d: any) => { created.push(d); return { id: "n1" }; },
            createPlatformRecipient: async (r: any) => { recipients.push(r); },
            updatePlatformNotification: async (id: string, d: any) => ({ id, ...d }),
        },
        platformNotificationMapper: { toResponse: (x: any) => x },
        schoolRepository: { findMany: async () => [{ id: "s1" }, { id: "s2" }, { id: "s3" }] },
        mailService: { sendLetter: async (to: string) => { mails.push(to); } },
        schoolAdminDirectory: { contactsOfSchools: async (ids: string[]) => ids.map(id => ({ email: `${id}@x.test`, firstName: null })) },
    };
    const base = { title: "t", message: "m", type: "system_alert", channels: ["IN_APP", "EMAIL"] } as any;
    return { uc: new SendPlatformNotificationUseCase(deps), created, recipients, mails, base };
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
        assert.deepEqual(w.mails.sort(), ["s1@x.test", "s2@x.test"]);
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
