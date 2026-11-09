/*
| CHARACTERISATION of "who does an announcement reach": written BEFORE the recipient lookup was moved out of
| SendSchoolNotificationUseCase into the shared AudienceRecipientService, and kept as the guard that the move
| (and everything built on it, such as Events) does not change who gets what. Only `build()` knows how the use case is wired.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notificationsWorld, code } from "./support/notifications-world";
import { SendSchoolNotificationUseCase } from "../../src/modules/notifications/usecases/send-school-notification.usecase";
import { SchoolNotificationMapper } from "../../src/modules/notifications/mappers/notification.mapper";
import { ACTIVE_STUDENT_WHERE, guardianAnnouncementWhere } from "../../src/modules/students/domain/student-eligibility";
import { AudienceRecipientService } from "../../src/modules/notifications/services/audience-recipient.service";

const NORTH = "22222222-2222-4222-8222-222222222222", C1 = "33333333-3333-4333-8333-333333333333";
const scope = (s: "ALL" | "BRANCH", branches: string[] = []): any => ({ scopeOf: () => s, branchScope: () => (s === "ALL" ? "ALL" : branches) });

const STUDENTS = [
    { id: "s1", firstName: "Tolu", userId: "us1", isActive: true },
    { id: "s2", firstName: "Femi", userId: null, isActive: true },           // no account: no contact
];
const GUARDIANS = [
    { id: "g1", firstName: "Ada", email: "ada@x.ng", phone: "0801", userId: "ug1" },
    { id: "g2", firstName: "Bola", email: null, phone: null, userId: null },
];
const STAFF = [{ id: "t1", userId: "ut1", isActive: true }];
const USERS = [
    { id: "us1", email: "tolu@x.ng", phone: "0803" }, { id: "ut1", email: "teacher@x.ng", phone: "0804" }, { id: "ug1", email: "ug1@x.ng", phone: "0805" },
];

/** A use case over fake repositories that record every `where` they are asked, and only return people matching `id: { in }` when given. */
function build(opts: { classBranch?: Record<string, string> } = {}) {
    const w = notificationsWorld();
    const seen: Record<string, any[]> = { students: [], guardians: [], staff: [] };
    const pick = (all: any[], where: any) => (where?.id?.in ? all.filter(x => where.id.in.includes(x.id)) : where?.AND?.[0]?.id?.in ? all.filter(x => where.AND[0].id.in.includes(x.id)) : all);
    const repos = {
        studentRepository:  { async findMany(where: any) { seen.students.push(where); return pick(STUDENTS, where); } } as any,
        guardianRepository: { async findMany(where: any) { seen.guardians.push(where); return pick(GUARDIANS, where); } } as any,
        staffRepository:    { async findMany(where: any) { seen.staff.push(where); return pick(STAFF, where); } } as any,
        userRepository:     { async findByIds(ids: string[]) { return USERS.filter(u => ids.includes(u.id)); } } as any,
    };
    const base: any = (w.send as any).d;
    const send = new SendSchoolNotificationUseCase({
        ...base, ...repos,
        audienceRecipientService: new AudienceRecipientService(repos),
        classRepository: { findAllClasses: async () => Object.entries(opts.classBranch ?? {}).map(([id, branchId]) => ({ id, branchId })) },
    } as any);
    return { w, send, seen };
}
const dto = (over: any = {}) => ({ title: "T", message: "M", type: "broadcast", targetType: "EVERYONE", channels: ["IN_APP", "EMAIL", "SMS"], includeGraduates: false, ...over });
const rowsFor = (w: any, type: string, channel: string) => w.rows.filter((r: any) => r.recipientType === type && r.channel === channel).map((r: any) => r.recipientEntityId).sort();

describe("who an announcement reaches (characterisation)", () => {
    it("ALL_STUDENTS: active, non-graduated students only; the contact comes from the user account", async () => {
        const { w, send, seen } = build();
        const out = await send.execute(dto({ targetType: "ALL_STUDENTS" }) as any, "sch", "u1");
        assert.deepEqual(seen.students, [{ ...ACTIVE_STUDENT_WHERE }]);
        assert.deepEqual(seen.guardians, []); assert.deepEqual(seen.staff, []);
        assert.equal(out.recipients, 2);
        assert.deepEqual(rowsFor(w, "STUDENT", "IN_APP"), ["s1", "s2"]);
        assert.deepEqual(rowsFor(w, "STUDENT", "EMAIL"), ["s1"], "s2 has no account, so no email");
        assert.deepEqual(rowsFor(w, "STUDENT", "SMS"), ["s1"]);
    });

    it("includeGraduates widens students to everyone still on the books", async () => {
        const { send, seen } = build();
        await send.execute(dto({ targetType: "ALL_STUDENTS", includeGraduates: true, channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.deepEqual(seen.students, [{ isActive: true }]);
    });

    it("ALL_PARENTS: the announcement rule for guardians; their own email and phone are used", async () => {
        const { w, send, seen } = build();
        const out = await send.execute(dto({ targetType: "ALL_PARENTS" }) as any, "sch", "u1");
        assert.deepEqual(seen.guardians, [guardianAnnouncementWhere(false)]);
        assert.equal(out.recipients, 2);
        assert.deepEqual(rowsFor(w, "GUARDIAN", "EMAIL"), ["g1"]);
        assert.deepEqual(rowsFor(w, "GUARDIAN", "SMS"), ["g1"]);
        assert.deepEqual(rowsFor(w, "GUARDIAN", "IN_APP"), ["g1", "g2"]);
        const grads = build();
        await grads.send.execute(dto({ targetType: "ALL_PARENTS", includeGraduates: true, channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.deepEqual(grads.seen.guardians, [guardianAnnouncementWhere(true)]);
    });

    it("ALL_STAFF: active staff only", async () => {
        const { w, send, seen } = build();
        const out = await send.execute(dto({ targetType: "ALL_STAFF" }) as any, "sch", "u1");
        assert.deepEqual(seen.staff, [{ isActive: true }]);
        assert.equal(out.recipients, 1);
        assert.deepEqual(rowsFor(w, "STAFF", "EMAIL"), ["t1"]);
    });

    it("EVERYONE: students, parents and staff in one go", async () => {
        const { send, seen } = build();
        const out = await send.execute(dto({ channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.equal(out.recipients, 2 + 2 + 1);
        assert.equal(seen.students.length + seen.guardians.length + seen.staff.length, 3);
    });

    it("specific people by id replace the group rule (and the branch narrowing still applies on top)", async () => {
        const { send, seen } = build();
        await send.execute(dto({ targetType: "STUDENT", studentIds: ["s1"], channels: ["IN_APP"] }) as any, "sch", "u1");
        await send.execute(dto({ targetType: "GUARDIAN", guardianIds: ["g2"], channels: ["IN_APP"] }) as any, "sch", "u1");
        await send.execute(dto({ targetType: "STAFF", staffIds: ["t1"], channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.deepEqual(seen.students, [{ id: { in: ["s1"] } }]);
        assert.deepEqual(seen.guardians, [{ id: { in: ["g2"] } }]);
        assert.deepEqual(seen.staff, [{ id: { in: ["t1"] } }]);

        const narrowed = build();
        await narrowed.send.execute(dto({ targetType: "STUDENT", studentIds: ["s1"], branchIds: [NORTH], channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.deepEqual(narrowed.seen.students, [{ AND: [{ id: { in: ["s1"] } }, { AND: [{ branchId: { in: [NORTH] } }] }] }]);
    });

    it("branch and class narrow students and parents; staff are narrowed by branch only", async () => {
        const { send, seen } = build();
        await send.execute(dto({ branchIds: [NORTH], channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.deepEqual(seen.students[0], { AND: [{ ...ACTIVE_STUDENT_WHERE }, { AND: [{ branchId: { in: [NORTH] } }] }] });
        assert.deepEqual(seen.staff[0], { AND: [{ isActive: true }, { branches: { some: { branchId: { in: [NORTH] } } } }] });
        const byClass = build();
        await byClass.send.execute(dto({ targetType: "ALL_STUDENTS", classIds: [C1], channels: ["IN_APP"] }) as any, "sch", "u1");
        assert.deepEqual(byClass.seen.students[0].AND[1], { AND: [{ enrolments: { some: { classId: { in: [C1] }, status: "active", term: { isCurrent: true } } } }] });
    });

    it("a BRANCH sender cannot pick people outside their branches by id", async () => {
        const { send } = build();
        // the (fake) repository returns only g1 for these ids: g2 was "outside" the sender's branches
        const fewer = build();
        (fewer.send as any).d.audienceRecipientService = new AudienceRecipientService({
            ...(fewer.send as any).d, guardianRepository: { async findMany() { return [GUARDIANS[0]]; } } as any,
        } as any);
        await assert.rejects(fewer.send.execute(dto({ targetType: "GUARDIAN", guardianIds: ["g1", "g2"], channels: ["IN_APP"] }) as any, "sch", "u1", scope("BRANCH", [NORTH])), code("AUDIENCE_OUT_OF_SCOPE"));
        const ok = await send.execute(dto({ targetType: "GUARDIAN", guardianIds: ["g1"], channels: ["IN_APP"] }) as any, "sch", "u1", scope("BRANCH", [NORTH]));
        assert.equal(ok.recipients, 1);
        // an ALL sender is never limited this way
        const all = await fewer.send.execute(dto({ targetType: "GUARDIAN", guardianIds: ["g1", "g2"], channels: ["IN_APP"] }) as any, "sch", "u1", scope("ALL"));
        assert.equal(all.recipients, 1);
    });

    it("a branch sender's own audience is limited to their branches when none is chosen", async () => {
        const { send, seen } = build();
        await send.execute(dto({ targetType: "ALL_STUDENTS", channels: ["IN_APP"] }) as any, "sch", "u1", scope("BRANCH", [NORTH]));
        assert.deepEqual(seen.students[0], { AND: [{ ...ACTIVE_STUDENT_WHERE }, { AND: [{ branchId: { in: [NORTH] } }] }] });
    });

    it("nobody found is a clear error", async () => {
        const { send } = build();
        await assert.rejects(send.execute(dto({ targetType: "STAFF", staffIds: ["nobody"], channels: ["IN_APP"] }) as any, "sch", "u1"), code("NO_RECIPIENTS"));
    });
});
