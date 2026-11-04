import type { DefinitionOrigin, Enforcement, FeatureKind } from "./foundation.db";

/*
|--------------------------------------------------------------------------
| FEATURE REGISTRY (code-owned)
| Every entitlement key the code can enforce. Synced into FeatureDefinition
| on deploy. Code owns: key, kind, module, meterKey, unit.
| Platform staff own (edited in the console, never overwritten by sync):
| name, description, enforcement, upsellMessage, isActive.
|--------------------------------------------------------------------------
*/

export interface FeatureDef {
    key:            string;
    kind:           FeatureKind;
    module:         string;
    name:           string;
    description?:   string;
    meterKey?:      string;
    unit?:          string;
    enforcement?:   Enforcement;
    origin?:        DefinitionOrigin;   // "PLATFORM" = seeded once, then owned by the console
    isActive?:      boolean;            // false = defined but not enforced yet
    requires?:      string[];           // other feature keys that must also be granted
    upsellMessage?: string;
}

export const FEATURE_REGISTRY: FeatureDef[] = [
    // ── Limits (replace Plan.studentLimit / Plan.staffLimit; -1 becomes unlimited) ──
    { key: "students.max", kind: "LIMIT", module: "people", name: "Active students", meterKey: "students.active", unit: "students" },
    { key: "staff.max",    kind: "LIMIT", module: "people", name: "Active staff",    meterKey: "staff.active",    unit: "staff" },

    // ── Communication ──
    { key: "notifications.email",    kind: "BOOLEAN", module: "notifications", name: "Email notifications" },
    { key: "notifications.sms",      kind: "BOOLEAN", module: "notifications", name: "SMS notifications" },
    { key: "notifications.bulk_sms", kind: "BOOLEAN", module: "notifications", name: "Bulk SMS broadcasts", requires: ["notifications.sms"] },

    // ── Academic ──
    { key: "modules.attendance",       kind: "BOOLEAN", module: "academic", name: "Attendance tracking" },
    { key: "modules.grades",           kind: "BOOLEAN", module: "academic", name: "Grade management" },
    { key: "grading.custom",           kind: "BOOLEAN", module: "academic", name: "Custom grading scales" },
    { key: "report_cards.pdf",         kind: "BOOLEAN", module: "academic", name: "Report card PDF" },
    { key: "report_cards.letterhead",  kind: "BOOLEAN", module: "academic", name: "Custom letterhead report cards", requires: ["report_cards.pdf"] },
    { key: "reports.advanced",         kind: "BOOLEAN", module: "academic", name: "Advanced reports" },

    // ── Finance ──
    { key: "modules.fees",             kind: "BOOLEAN", module: "finance", name: "Fee management" },
    { key: "fees.online_payments",     kind: "BOOLEAN", module: "finance", name: "Online fee payments", requires: ["modules.fees"] },
    { key: "fees.receipts",            kind: "BOOLEAN", module: "finance", name: "Payment receipts",   requires: ["modules.fees"] },
    { key: "modules.expenses",         kind: "BOOLEAN", module: "finance", name: "Expenses and bills" },
    { key: "finance.reports.accountant", kind: "BOOLEAN", module: "finance", name: "Accountant reports (ledger, trial balance, statements)", requires: ["modules.fees"] },
    { key: "finance.bank_reconciliation", kind: "BOOLEAN", module: "finance", name: "Bank reconciliation", requires: ["finance.reports.accountant"] },
    { key: "modules.payroll",          kind: "BOOLEAN", module: "finance", name: "Payroll and payslips", requires: ["modules.expenses"] },
    { key: "finance.budgets",          kind: "BOOLEAN", module: "finance", name: "Budgets", requires: ["modules.expenses"] },

    // ── Platform ──
    { key: "portal.guardian",          kind: "BOOLEAN", module: "platform", name: "Guardian portal" },
    { key: "domain.custom",            kind: "BOOLEAN", module: "platform", name: "Custom domain" },
    { key: "support.priority",         kind: "BOOLEAN", module: "platform", name: "Priority support", origin: "PLATFORM" },
    { key: "branches.multiple",        kind: "BOOLEAN", module: "platform", name: "Multiple branches", isActive: false },
    { key: "api.access",               kind: "BOOLEAN", module: "platform", name: "API access",        isActive: false },

    // ── New in Foundation (defined now, switched on in their own passes; plan values are set in the console) ──
    { key: "roles.custom.max",         kind: "LIMIT",   module: "access",   name: "Custom roles",          meterKey: "roles.custom", unit: "roles", isActive: false },
    { key: "automation.rules.max",     kind: "LIMIT",   module: "notifications", name: "Automation rules", meterKey: "automation.rules", unit: "rules" },
    { key: "storage.mb",               kind: "LIMIT",   module: "platform", name: "File storage",          meterKey: "storage.mb", unit: "MB", isActive: false },
    { key: "sms.monthly_quota",        kind: "QUOTA",   module: "notifications", name: "Monthly SMS quota", meterKey: "sms.sent_this_month", unit: "SMS", isActive: false },
    { key: "security.two_factor",      kind: "BOOLEAN", module: "security", name: "Two-factor authentication", isActive: false },
];

export const FEATURE_BY_KEY = new Map(FEATURE_REGISTRY.map((f) => [f.key, f]));

/** Dependency warnings for a set of granted boolean keys (used by the console when editing a plan). */
export function findDependencyWarnings(granted: Set<string>): string[] {
    const warnings: string[] = [];
    for (const key of granted) {
        for (const required of FEATURE_BY_KEY.get(key)?.requires ?? []) {
            if (!granted.has(required)) warnings.push(`${key} requires ${required}`);
        }
    }
    return warnings;
}
