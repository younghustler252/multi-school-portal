/*
| PLANS MODULE PERMISSION KEYS. Plans are platform data; a school never edits them.
| view lets e.g. a Support Agent see plans without being able to change prices or features.
*/
export const PLANS_PERMISSIONS = [
    { key: "platform.plans.view",   realm: "PLATFORM", module: "plans", scopes: ["ALL"], personas: ["STAFF"], label: "View plans and their features" },
    { key: "platform.plans.manage", realm: "PLATFORM", module: "plans", scopes: ["ALL"], personas: ["STAFF"], label: "Create and edit plans, prices and features", isSensitive: true },
] as const;
