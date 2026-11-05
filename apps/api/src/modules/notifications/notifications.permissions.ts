/*
| NOTIFICATION PERMISSION KEYS
| notifications.view            see the messages the school has sent (history)
| notifications.send            send an announcement to students, guardians or staff (email and SMS also need the plan feature and the school's preference). Scope ALL, or BRANCH (only your branches' students, parents and staff)
| notifications.platform.view   read the platform's messages to the school (billing notices, announcements) - the school admin
| platform.notifications.view   platform staff see the messages sent to schools (history)
| platform.notifications.send   platform staff send a message to schools (email goes to each school's admins), sensitive
| Reading and clearing your OWN messages needs no permission: it is your own inbox (any signed-in student, guardian or staff member).
*/
const ALL_SCOPE = ["ALL"] as const;
const staffOnly = ["STAFF"] as const;

export const NOTIFICATION_PERMISSIONS = [
    { key: "notifications.view",          realm: "SCHOOL", module: "notifications", scopes: ALL_SCOPE, personas: staffOnly, label: "View sent messages" },
    { key: "notifications.send",          realm: "SCHOOL", module: "notifications", scopes: ["ALL", "BRANCH"] as const, personas: staffOnly, label: "Send announcements", isSensitive: true },
    { key: "notifications.platform.view", realm: "SCHOOL", module: "notifications", scopes: ALL_SCOPE, personas: staffOnly, label: "Read messages from the platform" },
    { key: "platform.notifications.view", realm: "PLATFORM", module: "notifications", scopes: ALL_SCOPE, personas: staffOnly, label: "View messages sent to schools" },
    { key: "platform.notifications.send", realm: "PLATFORM", module: "notifications", scopes: ALL_SCOPE, personas: staffOnly, label: "Send messages to schools", isSensitive: true },
] as const;
