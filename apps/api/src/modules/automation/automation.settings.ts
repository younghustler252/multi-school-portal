import type { SettingDef } from "../../foundation/settings.engine";

/*
| AUTOMATION SETTINGS. One master switch per school. On by default: schools that change nothing keep the
| automatic messages they had before (the fee reminder).
*/
export const AUTOMATION_SETTING_DEFS: readonly SettingDef[] = [
    {
        key: "automation.enabled", kind: "boolean", group: "Automation", default: true,
        label: "Run automatic messages",
        description: "Off: no automation rule runs for this school (reminders, alerts). Rules and their settings are kept.",
    },
];
