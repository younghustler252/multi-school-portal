/*
| AUDIT PERMISSION KEYS.
| audit.view            a school sees its OWN activity log (who changed what, when, from where)
| platform.audit.view   platform staff see activity across all schools
| Both are sensitive: entries contain before/after values of changed records.
*/
export const AUDIT_PERMISSIONS = [
    { key: "audit.view",          realm: "SCHOOL",   module: "audit", scopes: ["ALL"], personas: ["STAFF"], label: "View the school's activity log", isSensitive: true },
    { key: "platform.audit.view", realm: "PLATFORM", module: "audit", scopes: ["ALL"], personas: ["STAFF"], label: "View activity across all schools", isSensitive: true },
] as const;
