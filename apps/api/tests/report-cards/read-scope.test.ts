import { test } from "node:test";
import assert from "node:assert/strict";
import { cardsViewWhere, mayViewClass, mayWorkOnClass } from "../../src/modules/report-cards/services/report-card-scope";
import { ClassOverviewUseCase, GetReportCardUseCase } from "../../src/modules/report-cards/usecases/report-cards-read.usecases";
import { GenerateReportCardsUseCase } from "../../src/modules/report-cards/usecases/generate-report-cards.usecase";
import { admin, classTeacher, access, fakeRepo, worldWith, pub, auditLog } from "./helpers";

test("who sees which cards: all, the classes I lead, my own (published only), my children's (published only), nobody", () => {
    assert.deepEqual(cardsViewWhere(admin()), {});
    assert.deepEqual(cardsViewWhere(classTeacher("t7")), { class: { classTeacherId: "t7" } });
    assert.deepEqual(cardsViewWhere(access({ persona: "STUDENT", me: "s1", can: ["report_cards.view"], scopes: { "report_cards.view": "OWN" } })), { studentId: "s1", status: { in: ["published", "sent"] } });
    assert.deepEqual(cardsViewWhere(access({ persona: "GUARDIAN", me: "g1", can: ["report_cards.view"], scopes: { "report_cards.view": "OWN" } })),
        { student: { guardianLinks: { some: { guardianId: "g1" } } }, status: { in: ["published", "sent"] } });
    assert.deepEqual(cardsViewWhere(access({ can: [] })), { id: { in: [] } });
    assert.deepEqual(cardsViewWhere(access({ can: ["report_cards.view"], scopes: { "report_cards.view": "BRANCH" } })), { id: { in: [] } });
    assert.deepEqual(cardsViewWhere(access({ persona: "GUARDIAN", me: null, can: ["report_cards.view"], scopes: { "report_cards.view": "OWN" } })), { id: { in: [] } });
});

test("class screens: administrators and the class teacher only; families never", () => {
    assert.equal(mayViewClass(admin(), "t1"), true);
    assert.equal(mayViewClass(classTeacher("t1"), "t1"), true);
    assert.equal(mayViewClass(classTeacher("t2"), "t1"), false);
    assert.equal(mayViewClass(access({ persona: "GUARDIAN", me: "g1", can: ["report_cards.view"], scopes: { "report_cards.view": "OWN" } }), "t1"), false);
    assert.equal(mayWorkOnClass(classTeacher("t1"), "t1"), true);
    assert.equal(mayWorkOnClass(classTeacher("t1"), null), false);
});

const world = () => worldWith([{ id: "m", name: "Maths", sheet: pub("sm") }, { id: "e", name: "English", sheet: null }], { sm: { a: [30, 50], b: [20, 40], c: [10, 20] } });

test("overview: live position for everyone, card status and staleness per student, counts, and what the viewer may do", async () => {
    const { repo, builder } = fakeRepo(world()); const a = auditLog();
    await new GenerateReportCardsUseCase({ reportCardsRepository: repo, reportCardBuilder: builder, auditService: a.svc }).execute({ classId: "c1", studentIds: ["a"] }, "sch", admin(), { userId: "u" });
    const uc = new ClassOverviewUseCase({ reportCardsRepository: repo, reportCardBuilder: builder });
    const r = await uc.execute({ classId: "c1" }, admin());
    assert.deepEqual(r.subjects, { published: 1, total: 2, list: [{ classSubjectId: "m", name: "Maths", published: true }, { classSubjectId: "e", name: "English", published: false }] });
    assert.deepEqual(r.students.map(s => s.live.position), [1, 2, 3]);
    assert.equal(r.students[0].card?.status, "draft"); assert.equal(r.students[0].card?.stale, false); assert.equal(r.students[1].card, null);
    assert.deepEqual(r.counts, { students: 3, noCard: 2, draft: 1, published: 0, stale: 0 });
    assert.deepEqual(r.can, { generate: true, publish: true });
    await assert.rejects(uc.execute({ classId: "c1" }, classTeacher("t9")), /cannot see this class/);
    await assert.rejects(uc.execute({ classId: "c1" }, access({ persona: "GUARDIAN", me: "g1", can: ["report_cards.view"], scopes: { "report_cards.view": "OWN" } })), /cannot see/);
});

test("opening a card: staff get stale flag and abilities, families get the card and the download only", async () => {
    const { repo, rows, builder } = fakeRepo(world()); const a = auditLog();
    await new GenerateReportCardsUseCase({ reportCardsRepository: repo, reportCardBuilder: builder, auditService: a.svc }).execute({ classId: "c1" }, "sch", admin(), { userId: "u" });
    const uc = new GetReportCardUseCase({ reportCardsRepository: repo, reportCardBuilder: builder });
    const staff: any = await uc.execute(rows[0].id, admin());
    assert.equal(staff.stale, false); assert.equal(staff.can.publish, true); assert.equal(staff.can.editPrincipalRemark, true); assert.equal(staff.snapshot.result.subjects[0].subjectName, "Maths");
    const teacher: any = await uc.execute(rows[0].id, classTeacher("t1"));
    assert.equal(teacher.can.editRemark, true); assert.equal(teacher.can.editPrincipalRemark, false); assert.equal(teacher.can.publish, false);
    const guardian = access({ persona: "GUARDIAN", me: "g1", can: ["report_cards.view"], scopes: { "report_cards.view": "OWN" } });
    await assert.rejects(uc.execute(rows[0].id, guardian), /not found/i);          // a draft does not exist for families
    rows[0].status = "published";
    const family: any = await uc.execute(rows[0].id, guardian);
    assert.deepEqual(family.can, { download: true }); assert.equal("stale" in family, false); assert.equal("unpublishReason" in family, false);
    await assert.rejects(uc.execute("ghost", admin()), /not found/i);
});
