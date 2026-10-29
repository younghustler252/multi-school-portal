/*
| SCHOOL SETTINGS PERMISSION KEYS
| school_settings.view     see the school's branding, report card template and preferences
| school_settings.manage   change them (logo colours, motto, report card template, stamp and signature, message and automation preferences)
| Nobody but the school admin holds these until a school grants them to another role; students and guardians never can.
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const SCHOOL_SETTINGS_PERMISSIONS = [
    { key: "school_settings.view",   realm: "SCHOOL", module: "school_settings", scopes: ALL_SCOPE, personas: staffOnly, label: "View school settings" },
    { key: "school_settings.manage", realm: "SCHOOL", module: "school_settings", scopes: ALL_SCOPE, personas: staffOnly, label: "Change school settings" },
] as const;
