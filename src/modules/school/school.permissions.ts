/*
| SCHOOL MODULE PERMISSION KEYS (register in the permission registry when it is built).
| School realm keys act on the CURRENT school (tenant database); platform keys act on any
| school (public database). A platform role such as "Support Agent" can hold platform.schools.view
| without being able to verify or suspend.
*/
export const SCHOOL_PERMISSIONS = [
    // ── School realm ─────────────────────────────────────────────────────
    { key: "school.view",             realm: "SCHOOL", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "View school profile" },
    { key: "school.update",           realm: "SCHOOL", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "Edit school profile, logo and setup", isSensitive: true },
    { key: "school.documents.manage", realm: "SCHOOL", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "Upload and view verification documents", isSensitive: true },
    { key: "school.payments.manage",  realm: "SCHOOL", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "Set up the payment (settlement) account", isSensitive: true },
    { key: "school.dashboard.view",   realm: "SCHOOL", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "View the school dashboard" },
    // ── Platform realm ───────────────────────────────────────────────────
    { key: "platform.schools.view",      realm: "PLATFORM", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "View all schools" },
    { key: "platform.schools.create",    realm: "PLATFORM", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "Create schools", isSensitive: true },
    { key: "platform.schools.manage",    realm: "PLATFORM", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "Edit school details (including locked fields)", isSensitive: true },
    { key: "platform.schools.verify",    realm: "PLATFORM", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "Verify or reject schools and their documents", isSensitive: true },
    { key: "platform.schools.suspend",   realm: "PLATFORM", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "Suspend and reactivate schools", isSensitive: true },
    { key: "platform.schools.documents", realm: "PLATFORM", module: "school", scopes: ["ALL"], personas: ["STAFF"], label: "View school verification documents", isSensitive: true },
] as const;
