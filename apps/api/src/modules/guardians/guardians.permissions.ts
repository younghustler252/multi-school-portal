/*
| GUARDIAN PERMISSION KEYS. Guardian contact details (email, phone, address) are private, so both keys are
| sensitive. guardians.manage is ALL-only. By default only the School Admin (grants-all) holds them; the platform can tick them
| for other roles. A guardian never needs a key to see their OWN children: that uses the GUARDIAN persona.
| guardians.view    see guardians and their contact details. Scope ALL, or BRANCH (guardians of students in your branches)
| guardians.manage  add, edit, link, unlink and invite guardians
*/
export const GUARDIAN_PERMISSIONS = [
    { key: "guardians.view",   realm: "SCHOOL", module: "guardians", scopes: ["ALL", "BRANCH"], personas: ["STAFF"], label: "View guardians and their contact details", isSensitive: true },
    { key: "guardians.manage", realm: "SCHOOL", module: "guardians", scopes: ["ALL"], personas: ["STAFF"], label: "Add, edit, link and invite guardians", isSensitive: true },
] as const;
