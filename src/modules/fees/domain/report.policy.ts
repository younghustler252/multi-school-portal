import { dayString } from "../../ledger/domain/ledger.dates";
import {
    AgeingBucket, AgeingReport, AgeingStudent, BucketTotals, CollectionGroup, CollectionLine, CollectionReport, CollectionRow, OpenInvoiceRow,
    Statement, StatementEntry, StatementSource,
} from "./report.entity";

/* Report maths that needs no database. Days are plain YYYY-MM-DD in the school's own zone; money is kobo. */

export const BUCKETS: AgeingBucket[] = ["CURRENT", "DAYS_1_30", "DAYS_31_60", "DAYS_61_90", "OVER_90"];
export const emptyBuckets = (): BucketTotals => ({ CURRENT: 0n, DAYS_1_30: 0n, DAYS_31_60: 0n, DAYS_61_90: 0n, OVER_90: 0n });

const MS_PER_DAY = 86_400_000;
const dayNumber = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / MS_PER_DAY);

/* How many days past its due date an invoice is on that day. No due date: it falls due on its issue date. Not yet due: zero or less. */
export function daysOverdue(asOf: string, dueDate: Date | null, issueDate: Date | null): number {
    const due = dueDate ?? issueDate;
    return due ? dayNumber(asOf) - dayNumber(dayString(due)) : 0;
}

export function bucketOf(days: number): AgeingBucket {
    if (days <= 0) return "CURRENT";
    if (days <= 30) return "DAYS_1_30";
    if (days <= 60) return "DAYS_31_60";
    if (days <= 90) return "DAYS_61_90";
    return "OVER_90";
}

/* AGEING: what each student owes, split by how late it is. Sorted by what is overdue, biggest first. */
export function buildAgeing(rows: OpenInvoiceRow[], asOf: string): AgeingReport {
    const byStudent = new Map<string, AgeingStudent>();
    const totals = emptyBuckets();
    for (const r of rows) {
        if (r.balanceKobo <= 0n) continue;
        const days = daysOverdue(asOf, r.dueDate, r.issueDate);
        const bucket = bucketOf(days);
        let s = byStudent.get(r.studentId);
        if (!s) {
            s = { studentId: r.studentId, studentName: r.studentName, admissionNumber: r.admissionNumber, classId: r.classId, className: r.className, buckets: emptyBuckets(), totalKobo: 0n, overdueKobo: 0n, oldestDaysOverdue: 0, invoices: 0 };
            byStudent.set(r.studentId, s);
        }
        s.buckets[bucket] += r.balanceKobo; s.totalKobo += r.balanceKobo; s.invoices++;
        if (bucket !== "CURRENT") s.overdueKobo += r.balanceKobo;
        if (days > s.oldestDaysOverdue) s.oldestDaysOverdue = days;
        totals[bucket] += r.balanceKobo;
    }
    const students = [...byStudent.values()].sort((a, b) => (b.overdueKobo > a.overdueKobo ? 1 : b.overdueKobo < a.overdueKobo ? -1 : a.studentName.localeCompare(b.studentName)));
    const totalKobo = BUCKETS.reduce((s, b) => s + totals[b], 0n);
    return { asOf, students, totals, totalKobo, overdueKobo: totalKobo - totals.CURRENT };
}

/* DEFAULTERS: the students with something overdue, most overdue first. */
export function defaultersOf(report: AgeingReport, minimumKobo = 1n): AgeingReport {
    const students = report.students.filter(s => s.overdueKobo >= minimumKobo);
    const totals = emptyBuckets();
    for (const s of students) for (const b of BUCKETS) totals[b] += s.buckets[b];
    const totalKobo = BUCKETS.reduce((x, b) => x + totals[b], 0n);
    return { asOf: report.asOf, students, totals, totalKobo, overdueKobo: totalKobo - totals.CURRENT };
}

/* COLLECTIONS: confirmed money in a period, grouped. "class" groups what went to invoices by the invoice's class; credit kept shows as "Kept as credit". */
export function buildCollections(rows: CollectionRow[], groupBy: CollectionGroup, from: string, to: string, labels: { branch?: Map<string, string> } = {}): CollectionReport {
    const lines = new Map<string, CollectionLine>();
    const add = (key: string, label: string, kobo: bigint, counted: boolean) => {
        const l = lines.get(key) ?? { key, label, count: 0, totalKobo: 0n };
        l.totalKobo += kobo; if (counted) l.count++;
        lines.set(key, l);
    };
    let total = 0n, credit = 0n;
    for (const r of rows) {
        total += r.amountKobo; credit += r.creditKobo;
        if (groupBy === "method") add(r.method, r.method, r.amountKobo, true);
        else if (groupBy === "day") add(r.paidOn, r.paidOn, r.amountKobo, true);
        else if (groupBy === "month") add(r.paidOn.slice(0, 7), r.paidOn.slice(0, 7), r.amountKobo, true);
        else if (groupBy === "branch") add(r.branchId ?? "none", r.branchId ? (labels.branch?.get(r.branchId) ?? r.branchId) : "No campus", r.amountKobo, true);
        else {
            const seen = new Set<string>();
            for (const c of r.byClass) { const k = c.classId ?? "none"; add(k, c.className ?? "No class", c.amountKobo, !seen.has(k)); seen.add(k); }
            if (r.creditKobo > 0n) add("credit", "Kept as credit", r.creditKobo, true);
        }
    }
    const sorted = [...lines.values()].sort((a, b) => (groupBy === "day" || groupBy === "month" ? a.key.localeCompare(b.key) : b.totalKobo > a.totalKobo ? 1 : b.totalKobo < a.totalKobo ? -1 : a.key.localeCompare(b.key)));
    return { from, to, groupBy, lines: sorted, payments: rows.length, totalKobo: total, creditKobo: credit };
}

/*
| A STUDENT'S STATEMENT. What the student owes goes up with each invoice and down with adjustments and payments; a refund of credit
| puts it back up. Below zero means the student is in credit. Payments that were reversed show as the payment and its reversal.
| `from` and `to` (inclusive) pick the entries shown; everything before `from` is rolled into the opening balance.
*/
export function buildStatement(src: StatementSource, from: string | null, to: string | null): Statement {
    type Raw = { date: string; order: number; entry: Omit<StatementEntry, "balanceKobo"> };
    const raws: Raw[] = [];
    const d = (v: Date | null) => (v ? dayString(v) : "0000-00-00");

    for (const i of src.invoices) {
        if (i.status === "draft" || i.status === "void") continue;
        raws.push({ date: d(i.issueDate ?? i.createdAt), order: 0, entry: { date: d(i.issueDate ?? i.createdAt), kind: "INVOICE", reference: i.invoiceNumber, description: `Invoice ${i.invoiceNumber ?? ""}`.trim(), amountKobo: i.subtotalKobo - i.discountKobo } });
    }
    for (const a of src.adjustments) {
        raws.push({ date: d(a.decidedAt), order: 1, entry: { date: d(a.decidedAt), kind: "ADJUSTMENT", reference: a.invoiceNumber, description: `${label(a.type)} on ${a.invoiceNumber ?? "invoice"}: ${a.reason}`, amountKobo: -a.amountKobo } });
    }
    for (const p of src.payments) {
        const when = d(p.paidAt);
        raws.push({ date: when, order: 2, entry: { date: when, kind: "PAYMENT", reference: p.receiptNumber, description: `Payment ${p.receiptNumber ?? ""} (${p.method})`.trim(), amountKobo: -p.amountKobo } });
        if (p.status === "REVERSED") raws.push({ date: when, order: 3, entry: { date: when, kind: "REVERSAL", reference: p.receiptNumber, description: `Payment ${p.receiptNumber ?? ""} reversed`.trim(), amountKobo: p.amountKobo } });
    }
    for (const r of src.refunds) raws.push({ date: d(r.paidAt), order: 4, entry: { date: d(r.paidAt), kind: "REFUND", reference: r.receiptNumber, description: `Refund of ${r.receiptNumber ?? "credit"}`, amountKobo: r.amountKobo } });

    raws.sort((x, y) => x.date.localeCompare(y.date) || x.order - y.order);

    let balance = 0n, opening = 0n;
    const entries: StatementEntry[] = [];
    const totals = { chargedKobo: 0n, adjustedKobo: 0n, paidKobo: 0n, refundedKobo: 0n };
    for (const r of raws) {
        const before = from !== null && r.date < from;
        const after = to !== null && r.date > to;
        balance += r.entry.amountKobo;
        if (before) { opening = balance; continue; }
        if (after) { balance -= r.entry.amountKobo; continue; }
        entries.push({ ...r.entry, balanceKobo: balance });
        const k = r.entry.kind, a = r.entry.amountKobo;
        if (k === "INVOICE") totals.chargedKobo += a; else if (k === "ADJUSTMENT") totals.adjustedKobo += -a;
        else if (k === "PAYMENT") totals.paidKobo += -a; else if (k === "REVERSAL") totals.paidKobo -= a; else totals.refundedKobo += a;
    }
    return { student: src.student, from, to, openingKobo: opening, entries, totals, closingKobo: balance, owedKobo: src.openBalanceKobo, creditKobo: src.creditKobo };
}

const label = (t: string) => ({ WAIVER: "Waiver", WRITE_OFF: "Write-off", CREDIT_NOTE: "Credit note", ADDITIONAL_DISCOUNT: "Extra discount" } as Record<string, string>)[t] ?? t;
