/*
| BRANCH PERMISSION KEYS.
| branches.view can be held at ALL scope (every branch: owner, School Admin, group roles) or BRANCH scope
| (only the branches the person is assigned to: a branch principal).
*/
export const BRANCH_PERMISSIONS = [
    { key: "branches.view",   realm: "SCHOOL", module: "branches", scopes: ["ALL", "BRANCH"], personas: ["STAFF"], label: "View branches" },
    { key: "branches.manage", realm: "SCHOOL", module: "branches", scopes: ["ALL"], personas: ["STAFF"], label: "Create and manage branches and assign staff", isSensitive: true },
] as const;
