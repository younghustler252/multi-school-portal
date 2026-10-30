/*
| FINANCE SETTINGS PERMISSION KEYS
| finance.settings.view     see the finance settings (approval threshold, budget enforcement, fiscal year...)
| finance.settings.manage   change them (sensitive: turning off approvals or allowing self approval weakens the controls)
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const FINANCE_SETTINGS_PERMISSIONS = [
    { key: "finance.settings.view",   realm: "SCHOOL", module: "finance_settings", scopes: ALL_SCOPE, personas: staffOnly, label: "View finance settings" },
    { key: "finance.settings.manage", realm: "SCHOOL", module: "finance_settings", scopes: ALL_SCOPE, personas: staffOnly, label: "Change finance settings", isSensitive: true },
] as const;
