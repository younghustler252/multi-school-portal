import type { SettingDef, SettingValue } from "../../../foundation/settings.engine";
import { coerceStored } from "../../../foundation/settings.engine";
import { Schedule, DEFAULT_SCHEDULE } from "./schedule";
import { addDays, daysBetween, formatDay, formatNaira } from "./automation-format";
import { receivesFeeReminder } from "../../students/domain/student-eligibility";

/*
|--------------------------------------------------------------------------
| AUTOMATION DEFINITIONS (code)
| What an automatic message IS: who it is about, when it applies, the words it uses (a catalog message), and the few numbers a
| school may tune. A school never writes logic: it switches a definition on, picks channels and a time, and changes the numbers
| inside the limits set here. New definitions (attendance alert, report card ready...) are added to this list by the module
| that owns the data; nothing else changes.
|
| `select` is pure: invoice rows in, the invoices that need a message out. The database query that finds the rows lives in the
| source repository; the window it asks for comes from `window()`.
|--------------------------------------------------------------------------
*/
export type AutomationChannel = "IN_APP" | "EMAIL" | "SMS";

export interface GuardianRow { id: string; firstName: string; email: string | null; phone: string | null; userId: string | null }

export interface InvoiceRow {
    invoiceId:     string;
    invoiceNumber: string | null;
    studentId:     string;
    studentName:   string;
    dueDate:       string;           // YYYY-MM-DD
    balanceKobo:   bigint;
    guardians:     GuardianRow[];
}

export interface AbsenceRow {
    attendanceId: string; studentId: string; studentName: string; className: string | null;
    status: "absent" | "late"; day: string; guardians: GuardianRow[];
}

/** Where definitions get their facts. The runner is given the real repository; tests give a fake. */
export interface AutomationSources {
    /** Unpaid or partly paid invoices with a due date in the range (both ends inclusive), with the student's active guardians. */
    findUnpaidInvoicesDueBetween(from: string, to: string, limit?: number): Promise<InvoiceRow[]>;
    /** Attendance rows of one day with one of these statuses, with the student's active guardians. */
    findAttendanceOn(day: string, statuses: ("absent" | "late")[]): Promise<AbsenceRow[]>;
}

/** One thing that needs a message: who gets it, the words' values, and the key that makes sure it is sent only once per occasion. */
export interface Occurrence { key: string; guardians: GuardianRow[]; values: Record<string, string> }

/** The pure part of a fee automation (also what the tests exercise). */
export interface FeeOccurrence { row: InvoiceRow; key: string }

export interface AutomationDefinition {
    key:             string;
    name:            string;
    description:     string;
    /** The catalog message this automation sends (message-templates module). */
    templateKey:     string;
    params:          readonly SettingDef[];
    defaultChannels: readonly AutomationChannel[];
    defaultSchedule: Schedule;
    /** Whether a school gets the rule switched on from the start. */
    defaultEnabled:  boolean;
    /** Everything that needs a message today for a rule with these numbers. The caller adds guardian_name and school_name. */
    find(src: AutomationSources, params: Record<string, SettingValue>, today: string): Promise<Occurrence[]>;
}

export interface FeeDefinition extends AutomationDefinition {
    /** Due dates to look at, inclusive. */
    window(params: Record<string, SettingValue>, today: string): { from: string; to: string };
    select(rows: InvoiceRow[], params: Record<string, SettingValue>, today: string): FeeOccurrence[];
}

const feeValues = (row: InvoiceRow): Record<string, string> => ({
    student_name: row.studentName, amount_due: formatNaira(row.balanceKobo), due_date: formatDay(row.dueDate), invoice_number: row.invoiceNumber ?? "",
});

function feeDefinition(d: Omit<FeeDefinition, "find" | "defaultEnabled"> & { defaultEnabled: boolean }): FeeDefinition {
    return {
        ...d,
        async find(src, params, today) {
            const { from, to } = d.window(params, today);
            const rows = await src.findUnpaidInvoicesDueBetween(from, to);
            return d.select(rows, params, today).map(o => ({ key: o.key, guardians: o.row.guardians, values: feeValues(o.row) }));
        },
    };
}

const num = (p: Record<string, SettingValue>, k: string): number => p[k] as number;

/* ---------- fee reminder: an invoice is due soon (replaces the old hard-coded 2 day reminder) ---------- */
export const FEE_DUE_SOON: FeeDefinition = feeDefinition({
    key: "fee.reminder_due_soon",
    name: "Fee reminder: due soon",
    description: "Reminds a student's guardians a few days before an unpaid invoice is due. Each invoice is reminded once.",
    templateKey: "fee.reminder",
    params: [
        { key: "days_before", kind: "integer", group: "When", default: 2, min: 0, max: 30,
          label: "Days before the due date", description: "0 reminds on the due date itself. 2 reminds two days before." },
    ],
    defaultChannels: ["IN_APP", "EMAIL"],          // what the old reminder did
    defaultSchedule: DEFAULT_SCHEDULE,             // every day at 08:00, as before
    defaultEnabled: true,                          // the school already had this reminder before automation existed
    window: (p, today) => ({ from: today, to: addDays(today, num(p, "days_before")) }),
    select: (rows, p, today) => rows
        .filter(r => receivesFeeReminder(Number(r.balanceKobo)) && r.dueDate >= today && r.dueDate <= addDays(today, num(p, "days_before")))
        .map(row => ({ row, key: `${row.invoiceId}:${row.dueDate}` })),
});

/* ---------- fee overdue notice: an invoice is past its due date and still unpaid ---------- */
export const FEE_OVERDUE: FeeDefinition = feeDefinition({
    key: "fee.overdue_notice",
    name: "Fee notice: overdue",
    description: "Tells a student's guardians that an invoice is past its due date and still unpaid, then repeats it every few days, up to a limit.",
    templateKey: "fee.overdue",
    params: [
        { key: "days_after", kind: "integer", group: "When", default: 1, min: 1, max: 90,
          label: "Days after the due date", description: "The first notice goes out this many days after the due date." },
        { key: "repeat_every_days", kind: "integer", group: "When", default: 7, min: 0, max: 60,
          label: "Repeat every (days)", description: "0 sends one notice only." },
        { key: "max_notices", kind: "integer", group: "When", default: 3, min: 1, max: 12,
          label: "Most notices per invoice", description: "After this many notices the invoice is left alone." },
    ],
    defaultChannels: ["IN_APP", "EMAIL"],
    defaultSchedule: DEFAULT_SCHEDULE,
    defaultEnabled: false,
    window: (p, today) => ({
        from: addDays(today, -(num(p, "days_after") + Math.max(num(p, "repeat_every_days") * num(p, "max_notices"), 30))),
        to:   addDays(today, -num(p, "days_after")),
    }),
    select: (rows, p, today) => {
        const after = num(p, "days_after"), every = num(p, "repeat_every_days"), max = num(p, "max_notices");
        const out: FeeOccurrence[] = [];
        for (const row of rows) {
            if (!receivesFeeReminder(Number(row.balanceKobo))) continue;
            const overdue = daysBetween(row.dueDate, today);
            if (overdue < after) continue;
            const period = every === 0 ? 0 : Math.floor((overdue - after) / every);     // 0 for the first notice, 1 for the second...
            if (period >= max) continue;
            out.push({ row, key: `${row.invoiceId}:n${period}` });
        }
        return out;
    },
});

/* ---------- attendance: a guardian hears when the register marks the student absent (reads the attendance module's data, never writes it) ---------- */
const ATTENDANCE_ABSENT: AutomationDefinition = {
    key: "attendance.absent_today",
    name: "Attendance: absence notice",
    description: "Tells a student's guardians when today's class register marks the student absent. Each student is told once per day.",
    templateKey: "attendance.absent",
    params: [
        { key: "include_late", kind: "boolean", group: "When", default: false,
          label: "Also tell guardians about lateness", description: "When on, a student marked late is included." },
    ],
    defaultChannels: ["IN_APP", "SMS"],
    defaultSchedule: { type: "daily", time: "11:00" },       // after the morning registers are taken
    defaultEnabled: false,
    async find(src, p, today) {
        const rows = await src.findAttendanceOn(today, p.include_late === true ? ["absent", "late"] : ["absent"]);
        return rows.map(r => ({
            key: `${r.studentId}:${r.day}`, guardians: r.guardians,
            values: { student_name: r.studentName, class_name: r.className ?? "your child's class", date: formatDay(r.day), status: r.status },
        }));
    },
};

export const AUTOMATION_DEFINITIONS: readonly AutomationDefinition[] = [FEE_DUE_SOON, FEE_OVERDUE, ATTENDANCE_ABSENT];
export const DEFINITION_BY_KEY: ReadonlyMap<string, AutomationDefinition> = new Map(AUTOMATION_DEFINITIONS.map(d => [d.key, d]));

/** The default value of every number of a definition. */
export const defaultParams = (def: AutomationDefinition): Record<string, SettingValue> =>
    Object.fromEntries(def.params.map(p => [p.key, p.default]));

/** A rule's stored numbers: a missing or no longer valid value falls back to the default (a bad value never stops a rule). */
export function resolveParams(def: AutomationDefinition, stored: unknown): Record<string, SettingValue> {
    const raw = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
    const out: Record<string, SettingValue> = {};
    for (const p of def.params) {
        const checked = Object.prototype.hasOwnProperty.call(raw, p.key) ? coerceStored(p, raw[p.key]) : null;
        out[p.key] = checked && checked.ok ? checked.value : p.default;
    }
    return out;
}
