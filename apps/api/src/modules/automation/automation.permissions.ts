/*
| AUTOMATION PERMISSION KEYS
| automation.view     see the automatic messages, their settings and what each run did
| automation.manage   switch them on or off, change channels, time and numbers, test and run them (they message parents, so sensitive)
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const AUTOMATION_PERMISSIONS = [
    { key: "automation.view",   realm: "SCHOOL", module: "automation", scopes: ALL_SCOPE, personas: staffOnly, label: "View automatic messages" },
    { key: "automation.manage", realm: "SCHOOL", module: "automation", scopes: ALL_SCOPE, personas: staffOnly, label: "Manage automatic messages", isSensitive: true },
] as const;
