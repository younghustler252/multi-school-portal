/*
| SESSION / TERM / CALENDAR PERMISSION KEYS.
| sessions.view    see the school years, terms, the current term and the calendar. Everyone who signs in needs this
|                  (staff, students, guardians), so it is on every default role.
| sessions.manage  create and edit sessions, terms and calendar events, and choose the current session / term
*/
export const SESSION_PERMISSIONS = [
    { key: "sessions.view",   realm: "SCHOOL", module: "sessions", scopes: ["ALL"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View sessions, terms and the school calendar" },
    { key: "sessions.manage", realm: "SCHOOL", module: "sessions", scopes: ["ALL"], personas: ["STAFF"], label: "Manage sessions, terms and the school calendar", isSensitive: true },
] as const;
