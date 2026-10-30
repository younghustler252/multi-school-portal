/*
| SUBSCRIPTIONS / BILLING PERMISSION KEYS.
| School realm: billing.view / billing.manage act on the CURRENT school's own subscription.
| Platform realm: platform.subscriptions.* act on any school's (a Support Agent can view without changing plans or money).
*/
export const SUBSCRIPTION_PERMISSIONS = [
    { key: "billing.view",   realm: "SCHOOL", module: "billing", scopes: ["ALL"], personas: ["STAFF"], label: "View plan, invoices and billing" },
    { key: "billing.manage", realm: "SCHOOL", module: "billing", scopes: ["ALL"], personas: ["STAFF"], label: "Change plan, pay invoices and manage cards", isSensitive: true },
    { key: "platform.subscriptions.view",   realm: "PLATFORM", module: "billing", scopes: ["ALL"], personas: ["STAFF"], label: "View all subscriptions, invoices and billing stats" },
    { key: "platform.subscriptions.manage", realm: "PLATFORM", module: "billing", scopes: ["ALL"], personas: ["STAFF"], label: "Change plans, extend periods, void and confirm invoices", isSensitive: true },
] as const;
