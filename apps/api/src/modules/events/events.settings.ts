import type { SettingDef } from "../../foundation/settings.engine";

/*
| EVENT SETTINGS. Off by default: a school opts in to event notices. It is read at the moment a notice would be sent,
| so turning it on never sends old notices (they are not retroactive); the manual "notify" route is for that.
*/
export const EVENT_SETTING_DEFS: readonly SettingDef[] = [
    {
        key: "events.notifications_enabled", kind: "boolean", group: "Events", default: false,
        label: "Send event notices",
        description: "Off (default): publishing, moving or cancelling an event tells nobody and reminders are skipped. On: the audience is notified on the channels chosen for each event (SMS and email also need your plan and the Messages settings).",
    },
];
