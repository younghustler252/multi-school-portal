/*
| STUDENT PERMISSION KEYS.
| students.view    ALL (every student), OWN (a student sees themselves, a guardian sees their linked children).
|                  BRANCH (only the students of your branches). ASSIGNED exists for later and shows nobody.
| students.manage  ALL only. Add, edit, deactivate, reactivate students and change their photo.
| students.import  ALL only (school admin). Bring in many students at once from a CSV file.
| students.transfer ALL only. Move a student to another branch (and their current class). The only way a student changes branch.
*/
export const STUDENT_PERMISSIONS = [
    { key: "students.view",   realm: "SCHOOL", module: "students", scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View students" },
    { key: "students.manage", realm: "SCHOOL", module: "students", scopes: ["ALL"], personas: ["STAFF"], label: "Add, edit, deactivate and reactivate students", isSensitive: true },
    { key: "students.import", realm: "SCHOOL", module: "students", scopes: ["ALL"], personas: ["STAFF"], label: "Import students from a CSV file", isSensitive: true },
    { key: "students.transfer", realm: "SCHOOL", module: "students", scopes: ["ALL"], personas: ["STAFF"], label: "Transfer a student to another branch", isSensitive: true },
] as const;
