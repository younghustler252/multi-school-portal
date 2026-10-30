/*
| NOTIFICATION PERMISSION KEYS
| notifications.view            see the messages the school has sent (history)
| notifications.send            send an announcement to students, guardians or staff (email and SMS also need the plan feature and the school's preference)
| notifications.platform.view   read the platform's messages to the school (billing notices, announcements) - the school admin
| Reading and clearing your OWN messages needs no permission: it is your own inbox (any signed-in student, guardian or staff member).
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const NOTIFICATION_PERMISSIONS = [
    { key: "notifications.view",          realm: "SCHOOL", module: "notifications", scopes: ALL_SCOPE, personas: staffOnly, label: "View sent messages" },
    { key: "notifications.send",          realm: "SCHOOL", module: "notifications", scopes: ALL_SCOPE, personas: staffOnly, label: "Send announcements", isSensitive: true },
    { key: "notifications.platform.view", realm: "SCHOOL", module: "notifications", scopes: ALL_SCOPE, personas: staffOnly, label: "Read messages from the platform" },
] as const;
