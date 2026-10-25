import type { IntegrityReport } from "./ledger-integrity";

/*
|--------------------------------------------------------------------------
| PERIOD CLOSE CHECKLIST (brief 8.1)
| Before a month is closed the books are checked:
|   blockers   the books are not sound (an unbalanced journal, a control that does not match). The month cannot be closed.
|   warnings   work is still open (draft invoices, payments waiting to be confirmed, expenses waiting for approval,
|              earlier months still open). The month can be closed once the person confirms it knowingly.
| Pure: the counts and the integrity report come in, the checklist comes out.
|--------------------------------------------------------------------------
*/

export type ChecklistSeverity = "blocker" | "warning" | "ok";

export interface ChecklistItem {
    key: string; label: string; severity: ChecklistSeverity; count: number; detail?: unknown;
}

export interface CloseCounts {
    draftInvoices: number;
    pendingPayments: number;
    pendingExpenses: number;
    earlierOpenPeriods: number;
}

export interface CloseChecklist {
    items: ChecklistItem[];
    blockers: number;
    warnings: number;
    canClose: boolean;                 // no blockers
    needsAcknowledgement: boolean;     // warnings exist
}

const WARNING_ITEMS: { key: keyof CloseCounts; label: string }[] = [
    { key: "draftInvoices",      label: "Draft invoices that were never issued" },
    { key: "pendingPayments",    label: "Payments waiting to be confirmed" },
    { key: "pendingExpenses",    label: "Expenses waiting for approval" },
    { key: "earlierOpenPeriods", label: "Earlier months that are still open" },
];

export function buildChecklist(counts: CloseCounts, integrity: IntegrityReport): CloseChecklist {
    const items: ChecklistItem[] = [];

    const byCheck = integrity.byCheck as Record<string, number>;
    const unbalanced = (byCheck.UNBALANCED_JOURNAL ?? 0) + (byCheck.TRIAL_BALANCE ?? 0);
    items.push({
        key: "balanced_books", label: "Every journal balances and the trial balance agrees",
        severity: unbalanced > 0 ? "blocker" : "ok", count: unbalanced,
        detail: unbalanced > 0 ? integrity.findings.filter(f => f.check === "UNBALANCED_JOURNAL" || f.check === "TRIAL_BALANCE").slice(0, 10) : undefined,
    });

    const other = integrity.findings.filter(f => f.check !== "UNBALANCED_JOURNAL" && f.check !== "TRIAL_BALANCE");
    items.push({
        key: "controls", label: "Receivable, payable and advance payment controls match the open invoices, bills and payments",
        severity: other.length > 0 ? "blocker" : "ok", count: other.length,
        detail: other.length > 0 ? other.slice(0, 10).map(f => ({ check: f.check, message: f.message })) : undefined,
    });

    for (const w of WARNING_ITEMS) {
        const n = counts[w.key];
        items.push({ key: w.key, label: w.label, severity: n > 0 ? "warning" : "ok", count: n });
    }

    const blockers = items.filter(i => i.severity === "blocker").length;
    const warnings = items.filter(i => i.severity === "warning").length;
    return { items, blockers, warnings, canClose: blockers === 0, needsAcknowledgement: warnings > 0 };
}
