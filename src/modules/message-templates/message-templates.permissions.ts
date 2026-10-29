/*
| MESSAGE TEMPLATE PERMISSION KEYS
| message_templates.view     see the school's messages (fee reminders...) with their words and placeholders
| message_templates.manage   change the words, reset to the default, preview (students and guardians never hold these)
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const MESSAGE_TEMPLATE_PERMISSIONS = [
    { key: "message_templates.view",   realm: "SCHOOL", module: "message_templates", scopes: ALL_SCOPE, personas: staffOnly, label: "View message templates" },
    { key: "message_templates.manage", realm: "SCHOOL", module: "message_templates", scopes: ALL_SCOPE, personas: staffOnly, label: "Edit message templates" },
] as const;
