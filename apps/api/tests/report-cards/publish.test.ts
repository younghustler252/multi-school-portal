import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerateReportCardsUseCase } from "../../src/modules/report-cards/usecases/generate-report-cards.usecase";
import { PublishReportCardsUseCase, UnpublishReportCardsUseCase } from "../../src/modules/report-cards/usecases/publish-report-cards.usecases";
import { UpdateRemarksUseCase } from "../../src/modules/report-cards/usecases/update-remarks.usecase";
import { ReportCardNotifier } from "../../src/modules/report-cards/services/report-card-notifier.service";
import { PublishDto, UnpublishDto, RemarksDto } from "../../src/modules/report-cards/dtos/report-card.dto";
import { admin, classTeacher, access, fakeRepo, worldWith, pub, auditLog } from "./helpers";

const NOW = new Date("2026-10-05T09:00:00Z");
const allPublished = () => worldWith(
    [{ id: "m", name: "Maths", sheet: pub("sm") }, { id: "e", name: "English", sheet: pub("se") }],
    { sm: { a: [30, 50], b: [20, 40], c: [10, 20] }, se: { a: [35, 45], b: [30, 30], c: [10, 15] } },
);
const partial = () => worldWith(
    [{ id: "m", name: "Maths", sheet: pub("sm") }, { id: "e", name: "English", sheet: null }],
    { sm: { a: [30, 50], b: [20, 40], c: [10, 20] } },
);

async function setup(world = allPublished(), notifier?: any) {
    const { repo, rows, builder } = fakeRepo(world); const a = auditLog();
    await new GenerateReportCardsUseCase({ reportCardsRepository: repo, reportCardBuilder: builder, auditService: a.svc }).execute({ classId: "c1" }, "sch", admin(), { userId: "u1" }, NOW);
    const sent: any[] = [];
    const n = notifier ?? { notifyPublished: async (_s: string, _u: string, cards: any[]) => { sent.push(...cards); return { told: cards.map(c => c.id), created: cards.length, duplicates: 0 }; } };
    const pubUc = new PublishReportCardsUseCase({ reportCardsRepository: repo, reportCardBuilder: builder, reportCardNotifier: n, auditService: a.svc });
    const unUc = new UnpublishReportCardsUseCase({ reportCardsRepository: repo, reportCardBuilder: builder, reportCardNotifier: n, auditService: a.svc });
    const remarksUc = new UpdateRemarksUseCase({ reportCardsRepository: repo, auditService: a.svc });
    return { repo, rows, builder, pubUc, unUc, remarksUc, sent, audit: a.entries, world };
}

test("publishing freezes the card, shows it, tells guardians and marks it sent", async () => {
    const s = await setup();
    const r = await s.pubUc.execute({ ids: s.rows.map(x => x.id) }, "sch", admin(), { userId: "p1" }, NOW);
    assert.equal(r.published, 3); assert.equal(r.guardiansTold, 3);
    assert.ok(s.rows.every(x => x.status === "sent" && x.publishedAt && x.publishedById === "p1"));
    assert.equal(s.sent.length, 3);
    assert.equal(s.audit.at(-1).action, "report_cards.published");
});

test("a card made before another subject was published is STALE and cannot go out until it is rebuilt", async () => {
    const s = await setup(partial());
    s.world.subjects[1].sheet = pub("se", "published", "2026-10-02T10:00:00Z");
    s.world.scores.se = { a: [30, 30], b: [30, 30], c: [30, 30] };
    const r = await s.pubUc.execute({ ids: s.rows.map(x => x.id), allowMissing: true }, "sch", admin(), { userId: "p1" }, NOW);
    assert.equal(r.published, 0);
    assert.ok(r.results.every(x => x.reason === "stale" && /More subjects/.test(x.detail![0])));
    assert.ok(s.rows.every(x => x.status === "draft"));
});

test("missing subjects block publishing unless the school allows it", async () => {
    const s = await setup(partial());
    const ids = s.rows.map(x => x.id);
    const blocked = await s.pubUc.execute({ ids }, "sch", admin(), { userId: "p1" }, NOW);
    assert.equal(blocked.published, 0); assert.match(blocked.results[0].detail![0], /English/);
    const ok = await s.pubUc.execute({ ids, allowMissing: true }, "sch", admin(), { userId: "p1" }, NOW);
    assert.equal(ok.published, 3);
    assert.equal(s.audit.at(-1).newValue.allowMissing, true);
});

test("one bad card does not stop the others, and already published cards are reported", async () => {
    const s = await setup();
    const ids = s.rows.map(x => x.id);
    await s.pubUc.execute({ ids: [ids[0]] }, "sch", admin(), { userId: "p1" }, NOW);
    const r = await s.pubUc.execute({ ids: [...ids, "ghost"] }, "sch", admin(), { userId: "p1" }, NOW);
    assert.equal(r.published, 2);
    const by = Object.fromEntries(r.results.map(x => [x.id, x.reason ?? "ok"]));
    assert.equal(by[ids[0]], "already_published"); assert.equal(by.ghost, "not_found");
});

test("a failure while telling guardians never undoes the publishing", async () => {
    const s = await setup(allPublished(), { notifyPublished: async () => { throw new Error("queue down"); } });
    const r = await s.pubUc.execute({ ids: s.rows.map(x => x.id) }, "sch", admin(), { userId: "p1" }, NOW);
    assert.equal(r.published, 3); assert.equal(r.guardiansTold, 0); assert.equal(r.notifyError, "queue down");
    assert.ok(s.rows.every(x => x.status === "published"));
});

test("publishing and taking back need report_cards.publish", async () => {
    const s = await setup();
    const ids = s.rows.map(x => x.id);
    await assert.rejects(s.pubUc.execute({ ids }, "sch", classTeacher(), { userId: "t" }, NOW), /not allowed/);
    await assert.rejects(s.unUc.execute({ ids, reason: "Wrong marks" }, "sch", classTeacher(), { userId: "t" }), /not allowed/);
});

test("taking back returns cards to draft, hides them and keeps the reason; remarks are editable again", async () => {
    const s = await setup();
    const ids = s.rows.map(x => x.id);
    await s.pubUc.execute({ ids }, "sch", admin(), { userId: "p1" }, NOW);
    await assert.rejects(s.remarksUc.execute(ids[0], { teacherRemark: "late edit" }, "sch", admin(), { userId: "u" }), (e: any) => e.code === "REPORT_CARD_NOT_EDITABLE");
    const r = await s.unUc.execute({ ids: [ids[0], ids[0]], reason: "Wrong marks for Maths" }, "sch", admin(), { userId: "p1" });
    assert.equal(r.unpublished, 1);
    const card = s.rows.find(x => x.id === ids[0])!;
    assert.equal(card.status, "draft"); assert.equal(card.publishedAt, null); assert.equal(card.unpublishReason, "Wrong marks for Maths");
    await s.remarksUc.execute(ids[0], { teacherRemark: "Fixed" }, "sch", admin(), { userId: "u" });
    assert.equal(card.teacherRemark, "Fixed");
    assert.equal(s.audit.find(e => e.action === "report_cards.unpublished").newValue.reason, "Wrong marks for Maths");
});

test("remarks: the class teacher writes the teacher remark, only the principal permission writes the principal remark; blank clears", async () => {
    const s = await setup();
    const id = s.rows[0].id;
    await s.remarksUc.execute(id, { teacherRemark: "  Works hard  " }, "sch", classTeacher("t1"), { userId: "u" });
    assert.equal(s.rows[0].teacherRemark, "Works hard");
    await assert.rejects(s.remarksUc.execute(id, { principalRemark: "Well done" }, "sch", classTeacher("t1"), { userId: "u" }), /principal/);
    await assert.rejects(s.remarksUc.execute(id, { teacherRemark: "x" }, "sch", classTeacher("t9"), { userId: "u" }), /class teacher/);
    await s.remarksUc.execute(id, { principalRemark: "Well done", teacherRemark: "" }, "sch", admin(), { userId: "u" });
    assert.equal(s.rows[0].principalRemark, "Well done"); assert.equal(s.rows[0].teacherRemark, null);
    assert.ok(s.audit.some(e => e.action === "report_cards.remarks_saved"));
});

test("DTOs: reason, remark length, and at least one remark", () => {
    assert.equal(UnpublishDto.safeParse({ ids: ["8f6f8a50-1111-4c1d-9a5e-0f1c2d3e4f5a"], reason: "no" }).success, false);
    assert.equal(RemarksDto.safeParse({}).success, false);
    assert.equal(RemarksDto.safeParse({ teacherRemark: "x".repeat(501) }).success, false);
    assert.equal(RemarksDto.safeParse({ teacherRemark: null }).success, true);
    assert.equal(PublishDto.safeParse({ ids: [] }).success, false);
});

test("notifier: only the channels the school can use, one message per guardian and channel, stable keys, no guardian contact = no message", async () => {
    const { repo } = fakeRepo(allPublished());
    repo.guardiansOf = async () => new Map([["a", [{ id: "g1", firstName: "Mrs", email: "m@x.test", phone: null, userId: "u1" }, { id: "g2", firstName: "Mr", email: null, phone: null, userId: null }]]]);
    const dispatched: any[] = [];
    const n = new ReportCardNotifier({
        reportCardsRepository: repo,
        notificationDispatchService: { dispatch: async (i: any) => { dispatched.push(...i.messages); return { created: i.messages.length, duplicates: 0, notificationIds: [] }; } } as any,
        channelPolicyService: { evaluate: async () => ({ allowed: ["IN_APP", "EMAIL"], blocked: [{ channel: "SMS", reason: "plan" }] }) } as any,
        messageTemplateService: {
            definition: () => ({ notificationType: "report_card_ready" }),
            effective: async (_k: string, c: string) => ({ subject: c === "EMAIL" ? "Report for {{student_name}}" : null, body: "Hi {{guardian_name}}, {{student_name}} ({{class_name}}) {{term_name}} at {{school_name}}", isCustomized: false, updatedAt: null }),
        } as any,
        schoolRepository: { findById: async () => ({ name: "Alpha School" }) } as any,
    });
    const snapshot: any = { student: { firstName: "Tolu", lastName: "A" }, term: "FIRST", session: "2026/2027", class: { name: "JSS 1" } };
    const r = await n.notifyPublished("sch", "p1", [{ id: "k1", studentId: "a", publishedAt: NOW, snapshot }]);
    assert.deepEqual(dispatched.map(m => `${m.recipient.recipientEntityId}:${m.channel}`).sort(), ["g1:EMAIL", "g1:IN_APP", "g2:IN_APP"]);
    assert.ok(dispatched.every(m => m.idempotencyKey.startsWith("report_card:k1:2026-10-05T09:00:00.000Z:")));
    assert.match(dispatched.find(m => m.channel === "EMAIL").message, /Hi Mrs, Tolu A \(JSS 1\) FIRST 2026\/2027 at Alpha School/);
    assert.deepEqual(r.told, ["k1"]);
});

test("notifier: when no channel is allowed nobody is told and nothing is dispatched", async () => {
    const { repo } = fakeRepo(allPublished());
    let called = false;
    const n = new ReportCardNotifier({ reportCardsRepository: repo, notificationDispatchService: { dispatch: async () => { called = true; return {} as any; } } as any,
        channelPolicyService: { evaluate: async () => ({ allowed: [], blocked: [] }) } as any, messageTemplateService: {} as any, schoolRepository: {} as any });
    const r = await n.notifyPublished("sch", "p1", [{ id: "k1", studentId: "a", publishedAt: NOW, snapshot: {} as any }]);
    assert.deepEqual(r, { told: [], created: 0, duplicates: 0 }); assert.equal(called, false);
});
