import type { SettingDef } from "../../foundation/settings.engine";

/*
| NOTIFICATION SETTINGS (what a school can switch for its own messages). Every default equals the behaviour
| before the setting existed: email and in-app on, SMS off (SMS costs money, so a school opts in).
| The plan decides what a school MAY use (features notifications.email / notifications.sms); these decide
| what it WANTS to use. A message goes out on a channel only when both agree.
*/
export const NOTIFICATION_SETTING_DEFS: readonly SettingDef[] = [
    {
        key: "notifications.email_enabled", kind: "boolean", group: "Messages", default: true,
        label: "Send emails",
        description: "Off: announcements and automatic messages are only shown inside the portal, nothing is emailed.",
    },
    {
        key: "notifications.sms_enabled", kind: "boolean", group: "Messages", default: false,
        label: "Send SMS",
        description: "Off (default): nothing is sent by SMS. SMS needs a plan that includes it and costs per message.",
    },
];
