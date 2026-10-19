/*
| STAFF PERMISSION KEYS.
| staff.view   ALL (everyone), BRANCH (staff in the person's branches), OWN (only themselves)
| staff.manage ALL or BRANCH. A branch-limited manager can only act on staff in their own branches.
*/
export const STAFF_PERMISSIONS = [
    { key: "staff.view",   realm: "SCHOOL", module: "staff", scopes: ["ALL", "BRANCH", "OWN"], personas: ["STAFF"], label: "View staff" },
    { key: "staff.manage", realm: "SCHOOL", module: "staff", scopes: ["ALL", "BRANCH"], personas: ["STAFF"], label: "Add, edit, deactivate staff and manage their access", isSensitive: true },
] as const;
