import { ExpenseLineRow, OpenBillRow } from "../repositories/expense-report.repository";
import { BUCKETS, bucketOf, daysOverdue } from "../../fees/domain/report.policy";
import type { AgeingBucket } from "../../fees/domain/report.entity";
import { dayString } from "../../ledger/domain/ledger.dates";

export type ExpenseGroupBy = "account" | "vendor" | "month" | "term";

export interface ExpenseGroup { key: string; label: string; totalKobo: bigint; lines: number; expenses: number }

/* What the school spent (approved expenses) grouped by account, vendor, month or term, biggest first. */
export function buildExpenseReport(rows: ExpenseLineRow[], groupBy: ExpenseGroupBy, termNames: Map<string, string> = new Map()): { groups: ExpenseGroup[]; totalKobo: bigint; expenses: number } {
    const groups = new Map<string, { label: string; total: bigint; lines: number; ids: Set<string> }>();
    for (const r of rows) {
        const [key, label] =
            groupBy === "account" ? [r.ledgerAccountId, `${r.accountCode} ${r.accountName}`] :
            groupBy === "vendor"  ? [r.vendorId ?? "NONE", r.vendorName ?? "No supplier"] :
            groupBy === "month"   ? [dayString(r.expenseDate).slice(0, 7), dayString(r.expenseDate).slice(0, 7)] :
                                    [r.termId ?? "NONE", r.termId ? termNames.get(r.termId) ?? "Unknown term" : "No term"];
        const g = groups.get(key) ?? { label, total: 0n, lines: 0, ids: new Set<string>() };
        g.total += r.amountKobo; g.lines++; g.ids.add(r.expenseId);
        groups.set(key, g);
    }
    const out = [...groups].map(([key, g]) => ({ key, label: g.label, totalKobo: g.total, lines: g.lines, expenses: g.ids.size }));
    out.sort((a, b) => (groupBy === "month" ? a.key.localeCompare(b.key) : a.totalKobo === b.totalKobo ? a.label.localeCompare(b.label) : a.totalKobo > b.totalKobo ? -1 : 1));
    return { groups: out, totalKobo: out.reduce((s, g) => s + g.totalKobo, 0n), expenses: new Set(rows.map(r => r.expenseId)).size };
}

export interface CreditorBill {
    id: string; expenseNumber: string | null; description: string; expenseDate: Date; dueDate: Date | null; totalKobo: bigint; paidKobo: bigint; balanceKobo: bigint;
    daysOverdue: number; bucket: AgeingBucket;
}
export interface Creditor { vendorId: string | null; vendorName: string; totalKobo: bigint; buckets: Record<AgeingBucket, bigint>; bills: CreditorBill[] }

const emptyBuckets = (): Record<AgeingBucket, bigint> => Object.fromEntries(BUCKETS.map(b => [b, 0n])) as Record<AgeingBucket, bigint>;

/* What the school owes suppliers: open bills by supplier, aged from the due date (the bill date when there is none). Biggest debt first. */
export function buildCreditors(rows: OpenBillRow[], asOf: string): { creditors: Creditor[]; totalKobo: bigint; buckets: Record<AgeingBucket, bigint> } {
    const byVendor = new Map<string, Creditor>();
    const totals = emptyBuckets();
    for (const r of rows) {
        const balance = r.totalKobo - r.paidKobo;
        if (balance <= 0n) continue;
        const days = daysOverdue(asOf, r.dueDate, r.expenseDate);
        const bucket = bucketOf(days);
        const key = r.vendorId ?? "NONE";
        const c = byVendor.get(key) ?? { vendorId: r.vendorId, vendorName: r.vendorName ?? "No supplier", totalKobo: 0n, buckets: emptyBuckets(), bills: [] };
        c.totalKobo += balance; c.buckets[bucket] += balance; totals[bucket] += balance;
        c.bills.push({ id: r.id, expenseNumber: r.expenseNumber, description: r.description, expenseDate: r.expenseDate, dueDate: r.dueDate, totalKobo: r.totalKobo, paidKobo: r.paidKobo, balanceKobo: balance, daysOverdue: days, bucket });
        byVendor.set(key, c);
    }
    const creditors = [...byVendor.values()].sort((a, b) => (a.totalKobo === b.totalKobo ? a.vendorName.localeCompare(b.vendorName) : a.totalKobo > b.totalKobo ? -1 : 1));
    return { creditors, totalKobo: creditors.reduce((s, c) => s + c.totalKobo, 0n), buckets: totals };
}
