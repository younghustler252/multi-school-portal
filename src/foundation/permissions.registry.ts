import { AUTH_PERMISSIONS }   from "../modules/auth/auth.permissions";
import { USER_PERMISSIONS }   from "../modules/user/user.permissions";
import { SCHOOL_PERMISSIONS } from "../modules/school/school.permissions";
import { PLANS_PERMISSIONS }  from "../modules/plans/plans.permissions";
import { SUBSCRIPTION_PERMISSIONS } from "../modules/subscriptions/subscriptions.permissions";
import { BRANCH_PERMISSIONS } from "../modules/branches/branches.permissions";
import { STAFF_PERMISSIONS } from "../modules/staff/staff.permissions";
import { STUDENT_PERMISSIONS } from "../modules/students/students.permissions";
import { GUARDIAN_PERMISSIONS } from "../modules/guardians/guardians.permissions";
import { SESSION_PERMISSIONS } from "../modules/sessions/sessions.permissions";
import { CLASS_PERMISSIONS } from "../modules/classes/classes.permissions";
import { ENROLMENT_PERMISSIONS } from "../modules/enrolment/enrolment.permissions";
import { ATTENDANCE_PERMISSIONS } from "../modules/attendance/attendance.permissions";
import { AUDIT_PERMISSIONS } from "../modules/audit/audit.permissions";
import { LEDGER_PERMISSIONS } from "../modules/ledger/ledger.permissions";
import { FEES_PERMISSIONS } from "../modules/fees/fees.permissions";
import { PAYMENTS_PERMISSIONS } from "../modules/payments/payments.permissions";
import { EXPENSES_PERMISSIONS } from "../modules/expenses/expenses.permissions";
import { PAYROLL_PERMISSIONS } from "../modules/payroll/payroll.permissions";
import { FINANCE_SETTINGS_PERMISSIONS } from "../modules/finance-settings/finance-settings.permissions";
import { BANK_RECONCILIATION_PERMISSIONS } from "../modules/bank-reconciliation/bank-reconciliation.permissions";
import { PAYROLL_TRANSFER_PERMISSIONS } from "../modules/payroll-transfers/payroll-transfers.permissions";
import { SCHOOL_SETTINGS_PERMISSIONS } from "../modules/school-settings/school-settings.permissions";
import { MESSAGE_TEMPLATE_PERMISSIONS } from "../modules/message-templates/message-templates.permissions";
import { NOTIFICATION_PERMISSIONS } from "../modules/notifications/notifications.permissions";
import { AUTOMATION_PERMISSIONS } from "../modules/automation/automation.permissions";

/*
|--------------------------------------------------------------------------
| PERMISSION REGISTRY (code)
| Every permission key the platform can enforce. Each MODULE owns its own keys (module.permissions.ts);
| this file only gathers them, adds the few keys other modules already read, and checks the whole list.
|
| Code owns:     key, realm, module, scopes, personas, requiresFeature, introducedInVersion.
| Platform owns: label, description, isSensitive, isDeprecated, sortOrder (editable in the console;
|                the sync never overwrites them).
| Rules: platform keys start with "platform." and school keys never do (the two realms never cross);
|        a key is never reused for something else; removing a key from code only reports it as orphaned.
| Each module pass adds its own file to the list below.
|--------------------------------------------------------------------------
*/

export type Scope   = "ALL" | "BRANCH" | "ASSIGNED" | "OWN";
export type Persona = "STAFF" | "STUDENT" | "GUARDIAN";

export interface PermissionDef {
    key:                 string;
    realm:               "PLATFORM" | "SCHOOL";
    module:              string;
    scopes:              readonly Scope[];
    personas:            readonly Persona[];
    requiresFeature?:    string;
    introducedInVersion?: number;
    label:               string;
    description?:        string;
    isSensitive?:        boolean;
}

// Keys that other modules already check (dashboard sections). The records modules
// (attendance, fees) take ownership of them in their own passes and add their other keys.
const CORE_PERMISSIONS: PermissionDef[] = [
    { key: "fees.view",       realm: "SCHOOL", module: "fees",       scopes: ["ALL", "BRANCH", "OWN"],  personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View fees and invoices" },
];

const ALL: readonly PermissionDef[] = [
    ...AUTH_PERMISSIONS,
    ...USER_PERMISSIONS,
    ...SCHOOL_PERMISSIONS,
    ...PLANS_PERMISSIONS,
    ...SUBSCRIPTION_PERMISSIONS,
    ...BRANCH_PERMISSIONS,
    ...STAFF_PERMISSIONS,
    ...STUDENT_PERMISSIONS,
    ...GUARDIAN_PERMISSIONS,
    ...SESSION_PERMISSIONS,
    ...CLASS_PERMISSIONS,
    ...ENROLMENT_PERMISSIONS,
    ...ATTENDANCE_PERMISSIONS,
    ...AUDIT_PERMISSIONS,
    ...LEDGER_PERMISSIONS,
    ...FEES_PERMISSIONS,
    ...PAYMENTS_PERMISSIONS,
    ...EXPENSES_PERMISSIONS,
    ...PAYROLL_PERMISSIONS,
    ...FINANCE_SETTINGS_PERMISSIONS,
    ...BANK_RECONCILIATION_PERMISSIONS,
    ...PAYROLL_TRANSFER_PERMISSIONS,
    ...SCHOOL_SETTINGS_PERMISSIONS,
    ...MESSAGE_TEMPLATE_PERMISSIONS,
    ...NOTIFICATION_PERMISSIONS,
    ...AUTOMATION_PERMISSIONS,
    ...CORE_PERMISSIONS,
];

export interface NormalizedPermission extends Required<Omit<PermissionDef, "requiresFeature" | "description">> {
    requiresFeature: string | null;
    description:     string | null;
    sortOrder:       number;
}

export const PERMISSION_REGISTRY: NormalizedPermission[] = ALL.map((p, i) => ({
    key: p.key, realm: p.realm, module: p.module, scopes: p.scopes, personas: p.personas,
    requiresFeature:     p.requiresFeature ?? null,
    introducedInVersion: p.introducedInVersion ?? 1,
    label:               p.label,
    description:         p.description ?? null,
    isSensitive:         p.isSensitive ?? false,
    sortOrder:           i * 10,
}));

/** Returns a list of problems; empty means the registry is valid. The sync refuses to run on an invalid registry. */
export function validatePermissionRegistry(): string[] {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const p of PERMISSION_REGISTRY) {
        if (seen.has(p.key)) problems.push(`${p.key}: defined more than once`);
        seen.add(p.key);
        if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(p.key)) problems.push(`${p.key}: key must be lowercase dotted words`);
        if (p.realm === "PLATFORM" && !p.key.startsWith("platform.")) problems.push(`${p.key}: platform keys must start with "platform."`);
        if (p.realm === "SCHOOL"   &&  p.key.startsWith("platform.")) problems.push(`${p.key}: school keys must not start with "platform."`);
        if (p.scopes.length === 0)   problems.push(`${p.key}: needs at least one scope`);
        if (p.personas.length === 0) problems.push(`${p.key}: needs at least one persona`);
        if (p.realm === "PLATFORM" && p.personas.some(x => x !== "STAFF")) problems.push(`${p.key}: platform keys are for STAFF only`);
    }
    return problems;
}

export const permissionByKey = (key: string): NormalizedPermission | undefined =>
    PERMISSION_REGISTRY.find(p => p.key === key);
