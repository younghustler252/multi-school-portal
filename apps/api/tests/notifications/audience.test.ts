import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { both, guardianAudienceWhere, resolveAudience, staffAudienceWhere, studentAudienceWhere } from "../../src/modules/notifications/domain/audience";
import { SendSchoolNotificationDto } from "../../src/modules/notifications/dtos/notification.dto";
import { NOTIFICATION_PERMISSIONS } from "../../src/modules/notifications/notifications.permissions";
import { notificationsWorld, code } from "./support/notifications-world";

const MAIN = "11111111-1111-4111-8111-111111111111", NORTH = "22222222-2222-4222-8222-222222222222", C1 = "33333333-3333-4333-8333-333333333333";
const sender = (scope: "ALL" | "BRANCH" | null, branches: string[] = []): any => ({ scopeOf: () => scope, branchScope: () => (scope === "ALL" ? "ALL" : branches) });
const base = { title: "Fees", message: "Please pay", type: "broadcast", channels: ["IN_APP"] };

describe("announcement audiences by branch and class", () => {
    it("notifications.send allows ALL or BRANCH; the request accepts branchIds and classIds", () => {
        assert.deepEqual([...NOTIFICATION_PERMISSIONS.find(p => p.key === "notifications.send")!.scopes], ["ALL", "BRANCH"]);
        assert.equal(SendSchoolNotificationDto.safeParse({ ...base, targetType: "ALL_PARENTS", branchIds: [NORTH], classIds: [C1] }).success, true);
        assert.equal(SendSchoolNotificationDto.safeParse({ ...base, targetType: "ALL_PARENTS", branchIds: ["nope"] }).success, false);
    });
    it("the where fragments narrow students, parents (through their children) and staff", () => {
        assert.deepEqual(studentAudienceWhere({}), {});
        assert.deepEqual(studentAudienceWhere({ branchIds: [NORTH] }), { AND: [{ branchId: { in: [NORTH] } }] });
        assert.deepEqual(guardianAudienceWhere({ branchIds: [NORTH] }), { studentLinks: { some: { student: { AND: [{ branchId: { in: [NORTH] } }] } } } });
        assert.deepEqual(guardianAudienceWhere({}), {});
        assert.deepEqual(staffAudienceWhere({ branchIds: [NORTH] }), { branches: { some: { branchId: { in: [NORTH] } } } });
        assert.deepEqual(both({}, {}), {}); assert.deepEqual(both({ a: 1 }, {}), { a: 1 }); assert.deepEqual(both({ a: 1 }, { b: 2 }), { AND: [{ a: 1 }, { b: 2 }] });
    });
    it("a school-wide sender may narrow freely; no sender context means no extra limit", () => {
        assert.deepEqual(resolveAudience(sender("ALL"), { targetType: "ALL_PARENTS", branchIds: [NORTH] }, new Map()), { filter: { branchIds: [NORTH], classIds: undefined }, limited: false });
        assert.equal(resolveAudience(undefined, { targetType: "ALL_PARENTS" }, new Map()).limited, false);
    });
    it("a branch sender is limited to their branches: all of them by default, a refusal for any other", () => {
        const s = sender("BRANCH", [NORTH, MAIN]);
        assert.deepEqual(resolveAudience(s, { targetType: "ALL_PARENTS" }, new Map()), { filter: { branchIds: [NORTH, MAIN], classIds: undefined }, limited: true });
        assert.deepEqual(resolveAudience(s, { targetType: "ALL_PARENTS", branchIds: [NORTH] }, new Map()).filter.branchIds, [NORTH]);
        assert.throws(() => resolveAudience(sender("BRANCH", [NORTH]), { targetType: "ALL_PARENTS", branchIds: [MAIN] }, new Map()), code("AUDIENCE_OUT_OF_SCOPE"));
        assert.throws(() => resolveAudience(sender("BRANCH", [NORTH]), { targetType: "ALL_PARENTS", classIds: [C1] }, new Map([[C1, MAIN]])), code("AUDIENCE_OUT_OF_SCOPE"));
        assert.throws(() => resolveAudience(sender("BRANCH", [NORTH]), { targetType: "ALL_PARENTS", classIds: [C1] }, new Map()), code("AUDIENCE_OUT_OF_SCOPE"));   // unknown class
        assert.equal(resolveAudience(sender("BRANCH", [NORTH]), { targetType: "ALL_PARENTS", classIds: [C1] }, new Map([[C1, NORTH]])).limited, true);
        assert.throws(() => resolveAudience(sender("BRANCH", []), { targetType: "ALL_PARENTS" }, new Map()), code("AUDIENCE_OUT_OF_SCOPE"));       // no branches
        assert.throws(() => resolveAudience(sender(null), { targetType: "ALL_PARENTS" }, new Map()), code("AUDIENCE_OUT_OF_SCOPE"));
    });
    it("a class cannot be chosen when staff are included", () => {
        for (const t of ["ALL_STAFF", "STAFF", "EVERYONE"]) assert.throws(() => resolveAudience(sender("ALL"), { targetType: t, classIds: [C1] }, new Map()), code("CLASS_AUDIENCE_NOT_FOR_STAFF"));
    });
    it("the send uses the narrowed audience, and a branch sender cannot reach someone else's people by id", async () => {
        const w = notificationsWorld();
        const seen: any = {};
        const d: any = (w.send as any).d;
        d.guardianRepository = { findMany: async (where: any) => { seen.where = where; return where?.AND ? [{ id: "g1", firstName: "Ada", email: null, phone: null, userId: "ug1" }] : []; } };
        d.classRepository = { findAllClasses: async () => [{ id: C1, branchId: NORTH }] };
        await w.send.execute({ ...base, targetType: "ALL_PARENTS", classIds: [C1] } as any, "sch", "u1", sender("BRANCH", [NORTH]));
        assert.deepEqual(JSON.stringify(seen.where).includes(NORTH), true);                              // narrowed to their branch
        assert.equal(w.audit.at(-1).newValue.branches[0], NORTH);
        // two parents asked for by id, but only one is in the sender's branches
        await assert.rejects(w.send.execute({ ...base, targetType: "GUARDIAN", guardianIds: [C1, MAIN] } as any, "sch", "u1", sender("BRANCH", [NORTH])), code("AUDIENCE_OUT_OF_SCOPE"));
    });
});
