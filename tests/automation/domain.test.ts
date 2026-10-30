import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSchedule, nextRunAfter, readSchedule, describeSchedule, DEFAULT_SCHEDULE } from "../../src/modules/automation/domain/schedule";
import { formatNaira, formatDay, daysBetween, addDays } from "../../src/modules/automation/domain/automation-format";
import { AUTOMATION_DEFINITIONS, FEE_DUE_SOON, FEE_OVERDUE, defaultParams, resolveParams, InvoiceRow } from "../../src/modules/automation/domain/automation-definitions";
import { TEMPLATE_BY_KEY } from "../../src/modules/message-templates/domain/template-catalog";
import { validateDefinitions } from "../../src/foundation/settings.engine";
import { renderPlain, renderMessage } from "../../src/modules/message-templates/domain/template-engine";

const at = (s: string) => new Date(s);

describe("schedule", () => {
    it("daily: 08:00 Lagos is 07:00 UTC; the next run is strictly after now", () => {
        const s = { type: "daily" as const, time: "08:00" };
        assert.equal(nextRunAfter(s, at("2026-10-30T05:00:00Z")).toISOString(), "2026-10-30T07:00:00.000Z");
        assert.equal(nextRunAfter(s, at("2026-10-30T07:00:00Z")).toISOString(), "2026-10-31T07:00:00.000Z", "exactly on the time means tomorrow");
        assert.equal(nextRunAfter(s, at("2026-10-30T07:00:01Z")).toISOString(), "2026-10-31T07:00:00.000Z");
        assert.equal(nextRunAfter(s, at("2026-10-30T23:30:00Z")).toISOString(), "2026-10-31T07:00:00.000Z", "23:30 UTC is already tomorrow 00:30 in Lagos");
    });
    it("daily at midnight and 23:59 behave across the Lagos date line", () => {
        assert.equal(nextRunAfter({ type: "daily", time: "00:00" }, at("2026-10-30T22:59:00Z")).toISOString(), "2026-10-30T23:00:00.000Z");
        assert.equal(nextRunAfter({ type: "daily", time: "23:59" }, at("2026-10-30T22:58:00Z")).toISOString(), "2026-10-30T22:59:00.000Z");
    });
    it("weekly: finds the right weekday, today included when the time is still ahead", () => {
        const monday8 = { type: "weekly" as const, weekday: 1, time: "08:00" };
        assert.equal(nextRunAfter(monday8, at("2026-10-30T10:00:00Z")).toISOString(), "2026-11-02T07:00:00.000Z");      // Friday -> Monday
        assert.equal(nextRunAfter(monday8, at("2026-11-02T06:00:00Z")).toISOString(), "2026-11-02T07:00:00.000Z");      // Monday before 08:00
        assert.equal(nextRunAfter(monday8, at("2026-11-02T08:00:00Z")).toISOString(), "2026-11-09T07:00:00.000Z");      // Monday after 08:00 -> next week
        assert.equal(nextRunAfter({ type: "weekly", weekday: 0, time: "08:00" }, at("2026-10-31T10:00:00Z")).toISOString(), "2026-11-01T07:00:00.000Z");
    });
    it("validation: strict, names the problem; a stored bad schedule falls back to the default", () => {
        assert.deepEqual(validateSchedule({ type: "daily", time: "08:00" }), []);
        assert.ok(validateSchedule({ type: "daily", time: "8:00" }).length);
        assert.ok(validateSchedule({ type: "daily", time: "24:00" }).length);
        assert.ok(validateSchedule({ type: "monthly", time: "08:00" }).length);
        assert.ok(validateSchedule({ type: "weekly", time: "08:00" }).length);
        assert.ok(validateSchedule({ type: "weekly", weekday: 7, time: "08:00" }).length);
        assert.ok(validateSchedule({ type: "daily", time: "08:00", cron: "* * * * *" }).length, "no sneaking in a cron string");
        assert.ok(validateSchedule(null).length);
        assert.deepEqual(readSchedule({ nonsense: true }), DEFAULT_SCHEDULE);
        assert.equal(describeSchedule({ type: "weekly", weekday: 1, time: "08:00" }), "Every Monday at 08:00");
    });
});

describe("formatting", () => {
    it("money is exact for any size and never goes through a float", () => {
        assert.equal(formatNaira(4500000n), "₦45,000.00");
        assert.equal(formatNaira(5n), "₦0.05");
        assert.equal(formatNaira(0n), "₦0.00");
        assert.equal(formatNaira(123456789012345678n), "₦1,234,567,890,123,456.78");
        assert.equal(formatNaira(-250n), "-₦2.50");
    });
    it("days", () => {
        assert.equal(formatDay("2026-11-05"), "5 Nov 2026");
        assert.equal(daysBetween("2026-10-30", "2026-11-02"), 3);
        assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
        assert.equal(addDays("2026-10-30", 3), "2026-11-02");
        assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    });
});

const guardian = { id: "g1", firstName: "Ada", email: "a@x.ng", phone: "0801", userId: "u1" };
const inv = (id: string, dueDate: string, balance = 100000n): InvoiceRow =>
    ({ invoiceId: id, invoiceNumber: id.toUpperCase(), studentId: "s1", studentName: "Tolu A", dueDate, balanceKobo: balance, guardians: [guardian] });

describe("definitions", () => {
    const dueSoon = FEE_DUE_SOON;
    const overdue = FEE_OVERDUE;

    it("the registry of definitions is sound: own params are valid, templates exist and use only their own variables", () => {
        for (const d of AUTOMATION_DEFINITIONS) {
            assert.deepEqual(validateDefinitions(d.params.map(p => ({ ...p, key: `automation.${p.key}` }))), [], d.key);
            assert.ok(TEMPLATE_BY_KEY.has(d.templateKey), `${d.key} points at a missing message`);
            assert.ok(d.defaultChannels.length > 0);
        }
        assert.equal(new Set(AUTOMATION_DEFINITIONS.map(d => d.key)).size, AUTOMATION_DEFINITIONS.length);
    });
    it("the due-soon default equals the old worker: two days ahead, in-app and email, every day at 08:00", () => {
        assert.deepEqual(defaultParams(dueSoon), { days_before: 2 });
        assert.deepEqual([...dueSoon.defaultChannels], ["IN_APP", "EMAIL"]);
        assert.deepEqual(dueSoon.defaultSchedule, { type: "daily", time: "08:00" });
    });
    it("due soon: picks invoices due from today to N days ahead, not past ones, not paid ones", () => {
        const today = "2026-10-30";
        const rows = [inv("a", "2026-10-29"), inv("b", "2026-10-30"), inv("c", "2026-11-01"), inv("d", "2026-11-02"), inv("e", "2026-10-31", 0n)];
        const got = dueSoon.select(rows, { days_before: 2 }, today).map(o => o.row.invoiceId);
        assert.deepEqual(got, ["b", "c"]);
        assert.deepEqual(dueSoon.window({ days_before: 2 }, today), { from: "2026-10-30", to: "2026-11-01" });
        assert.equal(dueSoon.select(rows, { days_before: 2 }, today)[0].key, "b:2026-10-30");
    });
    it("overdue: first notice after N days, then every M days, up to the limit; one-off when repeat is 0", () => {
        const p = { days_after: 1, repeat_every_days: 7, max_notices: 3 };
        const run = (due: string, today: string) => overdue.select([inv("x", due)], p, today).map(o => o.key);
        assert.deepEqual(run("2026-10-30", "2026-10-30"), [], "not overdue yet");
        assert.deepEqual(run("2026-10-29", "2026-10-30"), ["x:n0"], "1 day overdue: first notice");
        assert.deepEqual(run("2026-10-29", "2026-11-05"), ["x:n0"], "still the first notice's period, so the same key (no repeat)");
        assert.deepEqual(run("2026-10-29", "2026-11-06"), ["x:n1"], "7 days later: second notice");
        assert.deepEqual(run("2026-10-29", "2026-11-13"), ["x:n2"]);
        assert.deepEqual(run("2026-10-29", "2026-11-20"), [], "limit of 3 reached");
        assert.deepEqual(overdue.select([inv("x", "2026-09-01")], { ...p, repeat_every_days: 0 }, "2026-10-30").map(o => o.key), ["x:n0"], "one-off");
    });
    it("overdue window is bounded so ancient invoices are never scanned forever", () => {
        const w = overdue.window({ days_after: 1, repeat_every_days: 7, max_notices: 3 }, "2026-10-30");
        assert.deepEqual(w, { from: "2026-09-29", to: "2026-10-29" });
        const once = overdue.window({ days_after: 1, repeat_every_days: 0, max_notices: 1 }, "2026-10-30");
        assert.equal(once.from, "2026-09-29", "a one-off looks back 30 days plus the delay");
    });
    it("params: stored values are read forgivingly and bad ones fall back to the default", () => {
        assert.deepEqual(resolveParams(dueSoon, { days_before: 5 }), { days_before: 5 });
        assert.deepEqual(resolveParams(dueSoon, { days_before: "7" }), { days_before: 7 });
        assert.deepEqual(resolveParams(dueSoon, { days_before: 999 }), { days_before: 2 });
        assert.deepEqual(resolveParams(dueSoon, null), { days_before: 2 });
        assert.deepEqual(resolveParams(dueSoon, { other: 1 }), { days_before: 2 });
    });
});

describe("plain rendering (no double escaping)", () => {
    it("renderPlain leaves & and < alone; the email channel escapes later", () => {
        const t = { subject: "Fees  for {{student_name}}", body: "Hi {{guardian_name}} & family" };
        const plain = renderPlain(t, { student_name: "A<b>", guardian_name: "Ada" });
        assert.equal(plain.subject, "Fees for A<b>");
        assert.equal(plain.body, "Hi Ada & family");
        assert.ok(renderMessage("EMAIL", t, { student_name: "A", guardian_name: "Ada" }).body.includes("&amp;"), "the preview path still escapes");
        assert.deepEqual(renderPlain({ body: "{{x}}" }, {}).missing, ["x"]);
    });
});
