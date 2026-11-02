/*
| CLASS PERMISSION KEYS.
| classes.view    see classes, subjects and who teaches what. Scope ALL, or BRANCH (only the classes of your branches; subjects are school-wide)
| classes.manage  create, edit and delete classes and subjects, choose class teachers, class progression and subject teachers. Scope ALL, or BRANCH (only classes of your branches)
*/
export const CLASS_PERMISSIONS = [
    { key: "classes.view",   realm: "SCHOOL", module: "classes", scopes: ["ALL", "BRANCH"], personas: ["STAFF"], label: "View classes, subjects and teachers" },
    { key: "classes.manage", realm: "SCHOOL", module: "classes", scopes: ["ALL", "BRANCH"], personas: ["STAFF"], label: "Manage classes, subjects and teacher assignments", isSensitive: true },
] as const;
