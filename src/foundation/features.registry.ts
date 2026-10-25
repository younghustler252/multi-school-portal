import type { DefinitionOrigin, Enforcement, FeatureKind } from "./foundation.db";

/*
|--------------------------------------------------------------------------
| FEATURE REGISTRY (code-owned)
| Every entitlement key the code can enforce. Synced into FeatureDefinition
| on deploy. Code owns: key, kind, module, meterKey, unit.
| Platform staff own (edited in the console, never overwritten by sync):
| name, description, enforcement, upsellMessage, isActive.
|
| `legacyFlag` maps the old Plan.features JSON flag to the new key, used
| only by the one-time backfill.
|--------------------------------------------------------------------------
*/

export type LegacyFlag =
    | "smsNotifications" | "emailNotifications"
    | "reportCardPdf" | "customGrading" | "customReportCardTemplate"
    | "attendanceTracking" | "gradeManagement"
    | "paymentCollection" | "feeManagement" | "paymentReceipts"
    | "multipleBranches" | "prioritySupport" | "apiAccess" | "customDomain"
    | "parentPortal" | "bulkSms" | "advancedReports" | "whatsappNotifications";

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
    legacyFlag?:    LegacyFlag;
    requires?:      string[];           // other feature keys that must also be granted
    upsellMessage?: string;
}

export const FEATURE_REGISTRY: FeatureDef[] = [
    // ── Limits (replace Plan.studentLimit / Plan.staffLimit; -1 becomes unlimited) ──
    { key: "students.max", kind: "LIMIT", module: "people", name: "Active students", meterKey: "students.active", unit: "students" },
    { key: "staff.max",    kind: "LIMIT", module: "people", name: "Active staff",    meterKey: "staff.active",    unit: "staff" },

    // ── Communication ──
    { key: "notifications.email",    kind: "BOOLEAN", module: "notifications", name: "Email notifications",    legacyFlag: "emailNotifications" },
    { key: "notifications.sms",      kind: "BOOLEAN", module: "notifications", name: "SMS notifications",      legacyFlag: "smsNotifications" },
    { key: "notifications.bulk_sms", kind: "BOOLEAN", module: "notifications", name: "Bulk SMS broadcasts",    legacyFlag: "bulkSms", requires: ["notifications.sms"] },
    { key: "notifications.whatsapp", kind: "BOOLEAN", module: "notifications", name: "WhatsApp notifications", legacyFlag: "whatsappNotifications", isActive: false },

    // ── Academic ──
    { key: "modules.attendance",       kind: "BOOLEAN", module: "academic", name: "Attendance tracking", legacyFlag: "attendanceTracking" },
    { key: "modules.grades",           kind: "BOOLEAN", module: "academic", name: "Grade management",    legacyFlag: "gradeManagement" },
    { key: "grading.custom",           kind: "BOOLEAN", module: "academic", name: "Custom grading scales", legacyFlag: "customGrading" },
    { key: "report_cards.pdf",         kind: "BOOLEAN", module: "academic", name: "Report card PDF",       legacyFlag: "reportCardPdf" },
    { key: "report_cards.letterhead",  kind: "BOOLEAN", module: "academic", name: "Custom letterhead report cards", legacyFlag: "customReportCardTemplate", requires: ["report_cards.pdf"] },
    { key: "reports.advanced",         kind: "BOOLEAN", module: "academic", name: "Advanced reports",      legacyFlag: "advancedReports" },

    // ── Finance ──
    { key: "modules.fees",             kind: "BOOLEAN", module: "finance", name: "Fee management",          legacyFlag: "feeManagement" },
    { key: "fees.online_payments",     kind: "BOOLEAN", module: "finance", name: "Online fee payments",     legacyFlag: "paymentCollection", requires: ["modules.fees"] },
    { key: "fees.receipts",            kind: "BOOLEAN", module: "finance", name: "Payment receipts",        legacyFlag: "paymentReceipts",   requires: ["modules.fees"] },
    { key: "modules.expenses",         kind: "BOOLEAN", module: "finance", name: "Expenses and bills" },
    { key: "finance.reports.accountant", kind: "BOOLEAN", module: "finance", name: "Accountant reports (ledger, trial balance, statements)", requires: ["modules.fees"] },
    { key: "finance.budgets",          kind: "BOOLEAN", module: "finance", name: "Budgets", requires: ["modules.expenses"] },

    // ── Platform ──
    { key: "portal.guardian",          kind: "BOOLEAN", module: "platform", name: "Guardian portal",       legacyFlag: "parentPortal" },
    { key: "domain.custom",            kind: "BOOLEAN", module: "platform", name: "Custom domain",         legacyFlag: "customDomain" },
    { key: "support.priority",         kind: "BOOLEAN", module: "platform", name: "Priority support",      legacyFlag: "prioritySupport", origin: "PLATFORM" },
    { key: "branches.multiple",        kind: "BOOLEAN", module: "platform", name: "Multiple branches",     legacyFlag: "multipleBranches", isActive: false },
    { key: "api.access",               kind: "BOOLEAN", module: "platform", name: "API access",            legacyFlag: "apiAccess",        isActive: false },

    // ── New in Foundation (defined now, switched on in their own passes; plan values are set in the console) ──
    { key: "roles.custom.max",         kind: "LIMIT",   module: "access",   name: "Custom roles",          meterKey: "roles.custom", unit: "roles", isActive: false },
    { key: "automation.rules.max",     kind: "LIMIT",   module: "notifications", name: "Automation rules", meterKey: "automation.rules", unit: "rules", isActive: false },
    { key: "storage.mb",               kind: "LIMIT",   module: "platform", name: "File storage",          meterKey: "storage.mb", unit: "MB", isActive: false },
    { key: "sms.monthly_quota",        kind: "QUOTA",   module: "notifications", name: "Monthly SMS quota", meterKey: "sms.sent_this_month", unit: "SMS", isActive: false },
    { key: "security.two_factor",      kind: "BOOLEAN", module: "security", name: "Two-factor authentication", isActive: false },
];

export const FEATURE_BY_KEY = new Map(FEATURE_REGISTRY.map((f) => [f.key, f]));
export const FEATURE_BY_LEGACY_FLAG = new Map(
    FEATURE_REGISTRY.filter((f) => f.legacyFlag).map((f) => [f.legacyFlag as string, f]),
);

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
