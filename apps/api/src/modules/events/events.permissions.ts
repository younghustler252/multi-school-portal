/*
| EVENTS & CALENDAR PERMISSION KEYS
| Reading the calendar needs no new key: it stays on sessions.view (every persona has it); who SEES which event is decided
| by the event's audience, and drafts are visible to the people below.
| events.manage    create and edit events (drafts, and edits to published ones), delete drafts. Scope ALL, or BRANCH (only events for your own branches)
| events.publish   publish and cancel events, which tells many people (sensitive). Scope ALL, or BRANCH (only events for your own branches)
| events.types.manage  create, rename, recolour, deactivate and delete the school's OWN event types, and see inactive ones. Scope ALL only (types are school-wide).
|                      Held by the School Admin through the role's grant-everything flag. NOT given to the Principal or Branch Principal by any template.
| The legacy calendar routes under /sessions keep sessions.view / sessions.manage.
*/
const staffOnly = ["STAFF"] as const;
const scopes = ["ALL", "BRANCH"] as const;

export const EVENT_PERMISSIONS = [
    { key: "events.manage",  realm: "SCHOOL", module: "events", scopes, personas: staffOnly, label: "Create and edit school events" },
    { key: "events.publish", realm: "SCHOOL", module: "events", scopes, personas: staffOnly, label: "Publish and cancel school events", isSensitive: true },
    { key: "events.types.manage", realm: "SCHOOL", module: "events", scopes: ["ALL"] as const, personas: staffOnly, label: "Manage the school's custom event types" },
] as const;
