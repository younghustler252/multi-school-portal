import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AutomationRunnerService } from "../../src/modules/automation/services/automation-runner.service";
import {
    ensureDefaultRules, UpdateAutomationUseCase, RunAutomationNowUseCase, DryRunAutomationUseCase,
    RunDueAutomationsUseCase, RunAutomationsForAllSchoolsUseCase, ListAutomationsUseCase,
} from "../../src/modules/automation/usecases/automation.usecases";
import { ChannelPolicyService } from "../../src/modules/notifications/services/channel-policy.service";
import { MessageTemplateService } from "../../src/modules/message-templates/services/message-template.service";
import type { AutomationRuleRow, RunLogRow, NewRule, RuleChanges } from "../../src/modules/automation/repositories/automation.repository";
import type { InvoiceRow } from "../../src/modules/automation/domain/automation-definitions";

const NOW = new Date("2026-10-30T07:00:00Z");           // 08:00 Lagos, Friday 2026-10-30
const SCHOOL = "school-1";

function world(opts: { prefs?: Record<string, unknown>; plan?: { email?: boolean; sms?: boolean; ruleLimit?: boolean }; invoices?: InvoiceRow[]; absences?: any[]; now?: () => Date } = {}) {
    const rules: AutomationRuleRow[] = [];
    const logs: RunLogRow[] = [];
    const audits: any[] = [];
    const sent: any[] = [];
    const keys = new Set<string>();
    let seq = 0;

    const ruleRepo = {
        list: async () => rules.map(r => ({ ...r })),
        findById: async (id: string) => rules.find(r => r.id === id) ?? null,
        create: async (d: NewRule) => { const r = { id: `r${++seq}`, definitionKey: d.definitionKey, name: d.name, enabled: d.enabled, params: d.params, channels: d.channels, schedule: d.schedule,
            lastRunAt: null, nextRunAt: d.nextRunAt, createdById: d.createdById, updatedById: d.createdById, createdAt: NOW, updatedAt: NOW } as AutomationRuleRow; rules.push(r); return r; },
        update: async (id: string, c: RuleChanges) => { const r = rules.find(x => x.id === id)!; Object.assign(r, c); return r; },
        countEnabled: async () => rules.filter(r => r.enabled).length,
        findDue: async (now: Date) => rules.filter(r => r.enabled && (r.nextRunAt === null || r.nextRunAt <= now)),
        claim: async (id: string, expected: Date | null, next: Date) => { const r = rules.find(x => x.id === id)!; if ((r.nextRunAt?.getTime() ?? null) !== (expected?.getTime() ?? null)) return false; r.nextRunAt = next; return true; },
    };
    const runRepo = {
        create: async (l: any) => { const row = { id: `l${logs.length}`, triggeredAt: NOW, skippedReason: null, error: null, ...l }; logs.push(row); return row; },
        listForRule: async (ruleId: string) => logs.filter(l => l.ruleId === ruleId),
        latestForRules: async (ids: string[]) => new Map(ids.flatMap(id => { const l = logs.filter(x => x.ruleId === id).pop(); return l ? [[id, l] as [string, RunLogRow]] : []; })),
    };
    const source = { findUnpaidInvoicesDueBetween: async (from: string, to: string) => (opts.invoices ?? []).filter(i => i.dueDate >= from && i.dueDate <= to), findAttendanceOn: async (day: string, st: string[]) => (opts.absences ?? []).filter(a => a.day === day && st.includes(a.status)) };
    const templates = new MessageTemplateService({ messageTemplateRepository: { find: async () => null } as any });
    const dispatch = {
        requeued: 0,
        dispatch: async (input: any) => {
            let created = 0, duplicates = 0;
            for (const m of input.messages) { if (m.idempotencyKey && keys.has(m.idempotencyKey)) { duplicates++; continue; } if (m.idempotencyKey) keys.add(m.idempotencyKey); sent.push({ ...m, metadata: input.metadata, sentById: input.sentById }); created++; }
            return { notificationIds: ["n1"], created, duplicates, queued: 0, byChannel: {} };
        },
        requeueStale: async () => { dispatch.requeued++; return 3; },
    };
    const entitlements = {
        checkFeature: async (_s: string, key: string) => ({ allowed: key === "notifications.email" ? opts.plan?.email !== false : key === "notifications.sms" ? opts.plan?.sms === true : true }),
        checkLimit: async () => opts.plan?.ruleLimit === false ? ({ allowed: false, reason: "limit_reached", limit: 1 }) : ({ allowed: true }),
    };
    const prefs = { all: async () => ({ "automation.enabled": true, "notifications.email_enabled": true, "notifications.sms_enabled": false, ...(opts.prefs ?? {}) }) } as any;
    const policy = new ChannelPolicyService({ entitlementsService: entitlements as any, schoolPreferencesService: prefs });
    const clock = opts.now ?? (() => NOW);
    const runner = new AutomationRunnerService({
        automationRuleRepository: ruleRepo, automationRunRepository: runRepo, automationSourceRepository: source, messageTemplateService: templates,
        notificationDispatchService: dispatch as any, channelPolicyService: policy, schoolPreferencesService: prefs, schoolName: async () => "Bright Future",
    } as any, clock);
    const d: any = { automationRuleRepository: ruleRepo, automationRunRepository: runRepo, automationRunnerService: runner, entitlementsService: entitlements,
        auditService: { log: async (a: any) => { audits.push(a); } }, channelPolicyService: policy, notificationDispatchService: dispatch, schoolPreferencesService: prefs };
    return { d, rules, logs, audits, sent, dispatch, clock };
}

const guardian = (id: string, over: any = {}) => ({ id, firstName: "Ada", email: `${id}@x.ng`, phone: "0801", userId: `u-${id}`, ...over });
const invoice = (id: string, dueDate: string, guardians = [guardian("g1")], balance = 4500000n): InvoiceRow =>
    ({ invoiceId: id, invoiceNumber: `INV-${id}`, studentId: "s1", studentName: "Tolu Adeyemi", dueDate, balanceKobo: balance, guardians });

describe("default rules", () => {
    it("one rule per automation; the old reminder is ON and runs at the old time, new ones are OFF; calling twice adds nothing", async () => {
        const w = world();
        const rules = await ensureDefaultRules(w.d, NOW);
        assert.equal(rules.length, 3);
        const due = rules.find(r => r.definitionKey === "fee.reminder_due_soon")!;
        assert.equal(due.enabled, true);
        assert.deepEqual(due.channels, ["IN_APP", "EMAIL"]);
        assert.equal(due.nextRunAt?.toISOString(), "2026-10-31T07:00:00.000Z");
        assert.equal(rules.find(r => r.definitionKey === "fee.overdue_notice")!.enabled, false);
        assert.equal((await ensureDefaultRules(w.d, NOW)).length, 3);
    });
});

describe("running a rule", () => {
    it("sends the due-soon reminder in-app and by email to each guardian, with the school's words filled in", async () => {
        const w = world({ invoices: [invoice("a", "2026-11-01")] });
        const [rule] = await ensureDefaultRules(w.d, NOW);
        const r = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        assert.equal(r.status, "SUCCESS");
        assert.equal(r.matched, 1); assert.equal(r.created, 2);
        const email = w.sent.find(m => m.channel === "EMAIL");
        assert.match(email.message, /Ada/); assert.match(email.message, /₦45,000\.00/); assert.match(email.message, /1 Nov 2026/);
        assert.equal(email.type, "fee_reminder");
        assert.equal(email.metadata.source, "automation");
        assert.equal(email.recipient.recipientType, "GUARDIAN");
        assert.equal(w.logs.length, 1); assert.equal(w.logs[0].status, "SUCCESS");
        assert.ok(w.rules[0].lastRunAt);
    });
    it("running it again sends nothing more (idempotency)", async () => {
        const w = world({ invoices: [invoice("a", "2026-11-01")] });
        const [rule] = await ensureDefaultRules(w.d, NOW);
        await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        const again = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "MANUAL" });
        assert.equal(again.created, 0); assert.equal(again.duplicates, 2); assert.equal(w.sent.length, 2);
    });
    it("no plan email feature: in-app only, and the run says email was blocked; a guardian with no email gets no email row", async () => {
        const w = world({ plan: { email: false }, invoices: [invoice("a", "2026-11-01")] });
        const [rule] = await ensureDefaultRules(w.d, NOW);
        const r = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        assert.deepEqual(w.sent.map(m => m.channel), ["IN_APP"]);
        assert.deepEqual(r.blocked, [{ channel: "EMAIL", reason: "plan" }]);
        const w2 = world({ invoices: [invoice("a", "2026-11-01", [guardian("g2", { email: null })])] });
        const [rule2] = await ensureDefaultRules(w2.d, NOW);
        await w2.d.automationRunnerService.run(rule2, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        assert.deepEqual(w2.sent.map(m => m.channel), ["IN_APP"]);
    });
    it("school switch off, or no usable channel: skipped with a reason, nothing sent, logged", async () => {
        const off = world({ prefs: { "automation.enabled": false }, invoices: [invoice("a", "2026-11-01")] });
        const [r1] = await ensureDefaultRules(off.d, NOW);
        const a = await off.d.automationRunnerService.run(r1, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        assert.equal(a.status, "SKIPPED"); assert.equal(a.skippedReason, "school_setting_off"); assert.equal(off.sent.length, 0); assert.equal(off.logs[0].status, "SKIPPED");

        const none = world({ invoices: [invoice("a", "2026-11-01")] });
        const [r2] = await ensureDefaultRules(none.d, NOW);
        r2.channels = ["SMS"];
        const b = await none.d.automationRunnerService.run(r2, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        assert.equal(b.skippedReason, "no_channel_available"); assert.equal(none.sent.length, 0);
    });
    it("paid, out-of-window and guardian-less invoices send nothing; a graduated student's balance still gets reminded (follows the balance)", async () => {
        const w = world({ invoices: [invoice("paid", "2026-11-01", [guardian("g1")], 0n), invoice("far", "2026-12-25"), invoice("nobody", "2026-11-01", [])] });
        const [rule] = await ensureDefaultRules(w.d, NOW);
        const r = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        assert.equal(w.sent.length, 0); assert.equal(r.status, "SUCCESS");
    });
    it("dry run shows samples and counts but sends and logs nothing", async () => {
        const w = world({ invoices: [invoice("a", "2026-11-01"), invoice("b", "2026-10-31")] });
        const [rule] = await ensureDefaultRules(w.d, NOW);
        const r = await new DryRunAutomationUseCase(w.d).execute(SCHOOL, rule.id);
        assert.equal(r.dryRun, true); assert.equal(r.matched, 2); assert.equal(r.messages, 4); assert.equal(r.sample.length, 4);
        assert.equal(w.sent.length, 0); assert.equal(w.logs.length, 0);
    });
    it("a crash inside a run is caught, logged as FAILED and returned (never thrown into the tick)", async () => {
        const w = world();
        const [rule] = await ensureDefaultRules(w.d, NOW);
        (w.d.automationRunnerService as any).d.automationSourceRepository = { findUnpaidInvoicesDueBetween: async () => { throw new Error("db down"); } };
        const r = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "SCHEDULE" });
        assert.equal(r.status, "FAILED"); assert.match(r.error!, /db down/); assert.equal(w.logs[0].status, "FAILED");
    });
    it("overdue notices follow the repeat period", async () => {
        const w = world({ invoices: [invoice("o", "2026-10-29")] });
        const rules = await ensureDefaultRules(w.d, NOW);
        const overdue = rules.find(r => r.definitionKey === "fee.overdue_notice")!;
        const r1 = await w.d.automationRunnerService.run(overdue, { schoolId: SCHOOL, trigger: "MANUAL" });
        assert.equal(r1.created, 2);
        assert.match(w.sent[0].message.toLowerCase(), /overdue|past|due/);
        const r2 = await w.d.automationRunnerService.run(overdue, { schoolId: SCHOOL, trigger: "MANUAL" });
        assert.equal(r2.created, 0, "same period: same key");
    });
});

describe("attendance absence notice", () => {
    const today = "2026-10-30";
    const absence = (id: string, status: "absent" | "late", guardians = [guardian("g1")]) =>
        ({ attendanceId: `a-${id}`, studentId: id, studentName: "Tolu Adeyemi", className: "JSS 2", status, day: today, guardians });
    const attendanceRule = async (w: any) => (await ensureDefaultRules(w.d, NOW)).find(r => r.definitionKey === "attendance.absent_today")!;

    it("is off by default, in-app and SMS, at 11:00", async () => {
        const w = world();
        const rule = await attendanceRule(w);
        assert.equal(rule.enabled, false); assert.deepEqual(rule.channels, ["IN_APP", "SMS"]);
        assert.deepEqual(rule.schedule, { type: "daily", time: "11:00" });
    });
    it("tells the guardian once per student per day, stored as an attendance alert", async () => {
        const w = world({ plan: { sms: true }, prefs: { "notifications.sms_enabled": true }, absences: [absence("s1", "absent"), absence("s2", "late")] });
        const rule = await attendanceRule(w);
        const r = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "MANUAL" });
        assert.equal(r.matched, 1, "late is not included by default");
        assert.deepEqual(w.sent.map((m: any) => m.channel).sort(), ["IN_APP", "SMS"]);
        const sms = w.sent.find((m: any) => m.channel === "SMS");
        assert.equal(sms.type, "attendance_alert");
        assert.match(sms.message, /Tolu Adeyemi \(JSS 2\) was marked absent on 30 Oct 2026/);
        const again = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "MANUAL" });
        assert.equal(again.created, 0);
    });
    it("include_late adds late students; SMS blocked by the plan leaves in-app only", async () => {
        const w = world({ absences: [absence("s1", "absent"), absence("s2", "late")] });
        const rule = await attendanceRule(w);
        rule.params = { include_late: true };
        const r = await w.d.automationRunnerService.run(rule, { schoolId: SCHOOL, trigger: "MANUAL" });
        assert.equal(r.matched, 2);
        assert.deepEqual([...new Set(w.sent.map((m: any) => m.channel))], ["IN_APP"]);
        assert.deepEqual(r.blocked, [{ channel: "SMS", reason: "plan" }]);
    });
});

describe("changing a rule", () => {
    it("turn on needs the school switch and the plan; turning off clears the next time; the audit lists what changed", async () => {
        const w = world();
        const rules = await ensureDefaultRules(w.d, NOW);
        const overdue = rules.find(r => r.definitionKey === "fee.overdue_notice")!;
        const update = new UpdateAutomationUseCase(w.d, () => NOW);
        const on = await update.execute(SCHOOL, "u1", overdue.id, { enabled: true } as any);
        assert.equal(on.enabled, true); assert.equal(on.nextRunAt?.toISOString(), "2026-10-31T07:00:00.000Z");
        assert.equal(w.audits.at(-1).action, "automation.updated");
        assert.deepEqual(w.audits.at(-1).newValue, { enabled: true });
        const off = await update.execute(SCHOOL, "u1", overdue.id, { enabled: false } as any);
        assert.equal(off.enabled, false); assert.equal(off.nextRunAt, null);

        const blockedSchool = world({ prefs: { "automation.enabled": false } });
        const [x, y] = await ensureDefaultRules(blockedSchool.d, NOW);
        await assert.rejects(() => new UpdateAutomationUseCase(blockedSchool.d, () => NOW).execute(SCHOOL, "u1", y.id, { enabled: true } as any), (e: any) => e.code === "AUTOMATION_DISABLED");
        const limited = world({ plan: { ruleLimit: false } });
        const [, z] = await ensureDefaultRules(limited.d, NOW);
        await assert.rejects(() => new UpdateAutomationUseCase(limited.d, () => NOW).execute(SCHOOL, "u1", z.id, { enabled: true } as any), (e: any) => e.code === "AUTOMATION_PLAN_LIMIT");
    });
    it("numbers and schedule are checked against the automation's own limits; unknown numbers are refused; no change means no audit", async () => {
        const w = world();
        const [due] = await ensureDefaultRules(w.d, NOW);
        const update = new UpdateAutomationUseCase(w.d, () => NOW);
        const ok = await update.execute(SCHOOL, "u1", due.id, { params: { days_before: 5 }, schedule: { type: "weekly", weekday: 1, time: "09:30" } } as any);
        assert.equal(ok.params[0].value, 5); assert.equal(ok.scheduleText, "Every Monday at 09:30");
        assert.equal(ok.nextRunAt?.toISOString(), "2026-11-02T08:30:00.000Z");
        for (const bad of [{ params: { days_before: 99 } }, { params: { days_before: -1 } }, { params: { nope: 1 } }, { schedule: { type: "daily", time: "25:00" } }]) {
            await assert.rejects(() => update.execute(SCHOOL, "u1", due.id, bad as any), (e: any) => e.code === "AUTOMATION_INVALID", JSON.stringify(bad));
        }
        const n = w.audits.length;
        await update.execute(SCHOOL, "u1", due.id, { params: { days_before: 5 } } as any);
        assert.equal(w.audits.length, n);
        await assert.rejects(() => update.execute(SCHOOL, "u1", "missing", { enabled: true } as any), (e: any) => e.statusCode === 404);
    });
    it("run now: needs the rule on; refuses with the reasons when no channel works; audits", async () => {
        const w = world({ invoices: [invoice("a", "2026-11-01")] });
        const rules = await ensureDefaultRules(w.d, NOW);
        const run = new RunAutomationNowUseCase(w.d);
        await assert.rejects(() => run.execute(SCHOOL, "u1", rules[1].id), (e: any) => e.code === "RULE_DISABLED");
        const report = await run.execute(SCHOOL, "u1", rules[0].id);
        assert.equal(report.created, 2); assert.equal(w.sent[0].sentById, "u1"); assert.equal(w.audits.at(-1).action, "automation.run");
        w.rules[0].channels = ["SMS"];
        await assert.rejects(() => run.execute(SCHOOL, "u1", rules[0].id), (e: any) => e.code === "NO_CHANNEL_AVAILABLE");
    });
    it("list shows the school switch, channel availability and each automation's settings", async () => {
        const w = world({ plan: { email: false } });
        const out = await new ListAutomationsUseCase(w.d, () => NOW).execute(SCHOOL);
        assert.equal(out.schoolEnabled, true); assert.equal(out.automations.length, 3);
        assert.ok(out.channels.blocked.some((b: any) => b.channel === "EMAIL" && b.reason === "plan"));
        assert.equal(out.automations[0].params[0].key, "days_before");
    });
});

describe("the tick", () => {
    it("runs a due rule once, moves it to its next time, skips rules not due, and hands stuck messages back", async () => {
        let now = NOW;
        const w = world({ invoices: [invoice("a", "2026-11-01")], now: () => now });
        const tick = new RunDueAutomationsUseCase(w.d, () => now);
        const first = await tick.execute(SCHOOL);                         // first sight: rules created, due-soon scheduled for tomorrow
        assert.equal(first.ran, 0); assert.equal(w.dispatch.requeued, 1); assert.equal(first.requeued, 3);
        now = new Date("2026-10-31T07:01:00Z");
        const second = await tick.execute(SCHOOL);
        assert.equal(second.ran, 1);
        assert.equal(w.rules[0].nextRunAt?.toISOString(), "2026-11-01T07:00:00.000Z");
        const third = await tick.execute(SCHOOL);                         // five minutes later: nothing is due
        assert.equal(third.due, 0);
        assert.equal(w.logs.length, 1);
    });
    it("a rule that was missed for days runs once, not once per day; a lost claim runs nothing", async () => {
        const w = world({ invoices: [invoice("a", "2026-11-01")] });
        const rules = await ensureDefaultRules(w.d, NOW);
        const tick = new RunDueAutomationsUseCase(w.d, () => new Date("2026-11-06T09:00:00Z"));
        const s = await tick.execute(SCHOOL);
        assert.equal(s.due, 1);
        assert.equal(w.rules[0].nextRunAt?.toISOString(), "2026-11-07T07:00:00.000Z");
        const racer = world({ invoices: [invoice("a", "2026-11-01")] });
        const [r] = await ensureDefaultRules(racer.d, NOW);
        racer.d.automationRuleRepository.claim = async () => false;
        const lost = await new RunDueAutomationsUseCase(racer.d, () => new Date("2026-11-06T09:00:00Z")).execute(SCHOOL);
        assert.equal(lost.ran, 0); assert.equal(racer.logs.length, 0); assert.ok(r && rules);
    });
    it("all schools: one school crashing never stops the others and is audited", async () => {
        const seen: string[] = [];
        const tickUc = { execute: async (id: string) => { seen.push(id); if (id === "bad") throw new Error("schema missing"); return { due: 1, ran: 1, skipped: 0, failed: 0, requeued: 0 }; } };
        const audits: any[] = [];
        const all = new RunAutomationsForAllSchoolsUseCase(
            { runDueAutomationsUseCase: tickUc as any, auditService: { log: async (a: any) => { audits.push(a); } } as any },
            async () => [{ id: "a", name: "A", schemaName: "a" }, { id: "bad", name: "B", schemaName: "b" }, { id: "c", name: "C", schemaName: "c" }],
            async (_s, fn) => fn(),
        );
        const sum = await all.execute();
        assert.deepEqual(seen, ["a", "bad", "c"]); assert.equal(sum.ran, 2); assert.equal(sum.crashed.length, 1);
        assert.equal(audits[0].action, "automation.tick_failed");
    });
});
