/*
|--------------------------------------------------------------------------
| FINANCE SETTINGS (phase 6): the values that used to be constants in the finance modules.
|
| A school's own value is a row in the tenant table SchoolSettingValue (one row per key; deleting the row restores
| the default below). Pure: raw values in, a typed FinanceSettings out. No database, no clock.
|
| Writing is strict (the right type, inside the allowed range). Reading is forgiving: a stored value that is
| not valid any more (an old shape, a range that changed) falls back to the default instead of breaking the books.
|--------------------------------------------------------------------------
*/

export type BudgetEnforcementSetting = "off" | "warn" | "block";

export interface FinanceSettings {
    expenseApprovalRequired:      boolean;
    expenseApprovalThresholdKobo: bigint;
    allowSelfApproval:            boolean;
    budgetEnforcement:            BudgetEnforcementSetting;
    fiscalYearStartMonth:         number;
    graceDays:                    number;
    reconciliationBlocksClose:    boolean;
    reconciliationToleranceDays:  number;
    vatEnabled:                   boolean;
    vatRateBps:                   number;
}

export type SettingKind = "boolean" | "integer" | "enum";
export type SettingValue = boolean | number | string;

export interface FinanceSettingDef {
    key:         string;
    field:       keyof FinanceSettings;
    kind:        SettingKind;
    group:       string;
    label:       string;
    description: string;
    default:     SettingValue;
    min?:        number;
    max?:        number;
    options?:    readonly string[];
}

export const FINANCE_SETTING_DEFS: readonly FinanceSettingDef[] = [
    {
        key: "finance.expense_approval_required", field: "expenseApprovalRequired", kind: "boolean", group: "Approvals", default: true,
        label: "Require approval for large expenses",
        description: "When off, every expense approves itself when it is submitted.",
    },
    {
        key: "finance.expense_approval_threshold_kobo", field: "expenseApprovalThresholdKobo", kind: "integer", group: "Approvals", default: 5_000_000,
        min: 0, max: Number.MAX_SAFE_INTEGER,
        label: "Expense approval threshold (kobo)",
        description: "An expense at or above this amount waits for someone else to approve it. Below it, the expense approves itself. 5000000 kobo is N50,000.",
    },
    {
        key: "finance.allow_self_approval", field: "allowSelfApproval", kind: "boolean", group: "Approvals", default: false,
        label: "Let people approve their own requests",
        description: "Off (recommended): the person who asked for an expense, payroll run, refund or fee adjustment can never be the one who approves it.",
    },
    {
        key: "finance.budget_enforcement", field: "budgetEnforcement", kind: "enum", group: "Budgets", default: "warn",
        options: ["off", "warn", "block"],
        label: "When an expense goes over budget",
        description: "off: do nothing. warn: approve it and show a warning. block: refuse the approval.",
    },
    {
        key: "finance.fiscal_year_start_month", field: "fiscalYearStartMonth", kind: "integer", group: "Books", default: 1, min: 1, max: 12,
        label: "Fiscal year starts in month",
        description: "1 is January. Year-to-date reports count from the first day of this month.",
    },
    {
        key: "finance.grace_days", field: "graceDays", kind: "integer", group: "Fees", default: 0, min: 0, max: 365,
        label: "Late fee grace days",
        description: "An invoice counts as overdue this many days after its due date.",
    },
    {
        key: "finance.reconciliation_blocks_close", field: "reconciliationBlocksClose", kind: "boolean", group: "Bank reconciliation", default: false,
        label: "Block closing a month until bank accounts are reconciled",
        description: "Off: an unreconciled bank account is a warning on the close checklist. On: it stops the month from closing.",
    },
    {
        key: "finance.reconciliation_tolerance_days", field: "reconciliationToleranceDays", kind: "integer", group: "Bank reconciliation", default: 3, min: 0, max: 14,
        label: "Days between the books and the bank",
        description: "Automatic matching pairs a bank line with a book entry of the same amount dated within this many days.",
    },
    {
        key: "finance.vat_enabled", field: "vatEnabled", kind: "boolean", group: "Tax", default: false,
        label: "Track VAT on expenses",
        description: "Off (most schools): bills carry no VAT. On: each bill line can carry the input VAT the supplier charged, kept in the VAT receivable account so it can be claimed.",
    },
    {
        key: "finance.vat_rate_bps", field: "vatRateBps", kind: "integer", group: "Tax", default: 750, min: 0, max: 5000,
        label: "VAT rate (basis points)",
        description: "Used when a bill line is marked vatable without an exact VAT amount. 750 is 7.5%. A line can always carry the exact VAT from the supplier's invoice instead.",
    },
];

export const FINANCE_SETTING_BY_KEY: ReadonlyMap<string, FinanceSettingDef> = new Map(FINANCE_SETTING_DEFS.map(d => [d.key, d]));

export type Checked = { ok: true; value: SettingValue } | { ok: false; message: string };

const inRange = (def: FinanceSettingDef, n: number): string | null => {
    if (def.min !== undefined && n < def.min) return `${def.label}: must be at least ${def.min}`;
    if (def.max !== undefined && n > def.max) return `${def.label}: must be at most ${def.max}`;
    return null;
};

/** Strict check for a value somebody is saving. */
export function validateSettingValue(def: FinanceSettingDef, raw: unknown): Checked {
    switch (def.kind) {
        case "boolean":
            return typeof raw === "boolean" ? { ok: true, value: raw } : { ok: false, message: `${def.label}: must be true or false` };
        case "integer": {
            if (typeof raw !== "number" || !Number.isInteger(raw)) return { ok: false, message: `${def.label}: must be a whole number` };
            const problem = inRange(def, raw);
            return problem ? { ok: false, message: problem } : { ok: true, value: raw };
        }
        case "enum":
            return typeof raw === "string" && def.options!.includes(raw)
                ? { ok: true, value: raw }
                : { ok: false, message: `${def.label}: must be one of ${def.options!.join(", ")}` };
    }
}

/** Forgiving read of a stored value: accepts "true" and "3" written by older code, then applies the same rules. */
function coerceStored(def: FinanceSettingDef, raw: unknown): Checked {
    if (def.kind === "boolean" && (raw === "true" || raw === "false")) raw = raw === "true";
    if (def.kind === "integer" && typeof raw === "string" && /^-?\d+$/.test(raw.trim())) raw = Number(raw.trim());
    return validateSettingValue(def, raw);
}

export const defaultFinanceSettings = (): FinanceSettings => resolveFinanceSettings({});

/** The school's effective settings: its own valid overrides, the default for everything else. */
export function resolveFinanceSettings(overrides: Record<string, unknown>): FinanceSettings {
    const out: Record<string, unknown> = {};
    for (const def of FINANCE_SETTING_DEFS) {
        const stored = Object.prototype.hasOwnProperty.call(overrides, def.key) ? coerceStored(def, overrides[def.key]) : null;
        const value = stored && stored.ok ? stored.value : def.default;
        out[def.field] = def.field === "expenseApprovalThresholdKobo" ? BigInt(value as number) : value;
    }
    return out as unknown as FinanceSettings;
}

/** One row per setting for the settings screen: what it is, what applies now, and whether the school changed it. */
export function describeSettings(overrides: Record<string, unknown>) {
    return FINANCE_SETTING_DEFS.map(def => {
        const stored = Object.prototype.hasOwnProperty.call(overrides, def.key) ? coerceStored(def, overrides[def.key]) : null;
        const overridden = !!stored && stored.ok;
        return {
            key: def.key, group: def.group, label: def.label, description: def.description, kind: def.kind,
            value: overridden ? (stored as { value: SettingValue }).value : def.default,
            default: def.default, isOverridden: overridden,
            ...(def.min !== undefined && { min: def.min }), ...(def.max !== undefined && { max: def.max }),
            ...(def.options && { options: def.options }),
        };
    });
}

/*
| What the finance modules depend on. The reader is OPTIONAL in their dependencies: when it is absent
| (unit tests that build a use case by hand) the defaults apply, which are the values the constants used to hold.
*/
export interface FinanceSettingsReader { get(): Promise<FinanceSettings> }

export async function settingsOf(d: { financeSettingsService?: FinanceSettingsReader }): Promise<FinanceSettings> {
    return d.financeSettingsService ? d.financeSettingsService.get() : defaultFinanceSettings();
}
