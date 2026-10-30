/*
| CLASS PERMISSION KEYS.
| classes.view    see classes, subjects and who teaches what (staff roles; students and guardians see their own class through enrolment)
| classes.manage  create, edit and delete classes and subjects, choose class teachers, class progression and subject teachers
*/
export const CLASS_PERMISSIONS = [
    { key: "classes.view",   realm: "SCHOOL", module: "classes", scopes: ["ALL"], personas: ["STAFF"], label: "View classes, subjects and teachers" },
    { key: "classes.manage", realm: "SCHOOL", module: "classes", scopes: ["ALL"], personas: ["STAFF"], label: "Manage classes, subjects and teacher assignments", isSensitive: true },
] as const;
