/*
| ROLE PERMISSION KEYS.
| roles.view   ALL only: see the school's roles, their permissions, and who holds each one.
| roles.manage ALL only: create a custom role, edit an editable role's permissions, delete an unused one, rename.
| Not BRANCH/ASSIGNED/OWN-scoped: a role applies school-wide by nature, so handing it out at a narrower scope
| would be meaningless. Deliberately NOT given to any role template by default (not even principal/bursar) — only
| the locked, grants-all School Admin role has it out of the box. A school admin can hand it to someone else
| through a custom role of their own, same as any other sensitive permission.
*/
export const ROLES_PERMISSIONS = [
    { key: "roles.view",   realm: "SCHOOL", module: "roles", scopes: ["ALL"], personas: ["STAFF"], label: "View roles, their permissions, and who holds each one" },
    { key: "roles.manage", realm: "SCHOOL", module: "roles", scopes: ["ALL"], personas: ["STAFF"], label: "Create, edit and delete roles", isSensitive: true },
] as const;
