/*
| STUDENT PERMISSION KEYS.
| students.view    ALL (every student), OWN (a student sees themselves, a guardian sees their linked children).
|                  BRANCH and ASSIGNED exist for later: until Enrolment is switched on they show NO students
|                  (safer than showing everyone), see services/student-scope.ts.
| students.manage  ALL only. Add, edit, deactivate, reactivate students and change their photo.
| students.import  ALL only (school admin). Bring in many students at once from a CSV file.
*/
export const STUDENT_PERMISSIONS = [
    { key: "students.view",   realm: "SCHOOL", module: "students", scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View students" },
    { key: "students.manage", realm: "SCHOOL", module: "students", scopes: ["ALL"], personas: ["STAFF"], label: "Add, edit, deactivate and reactivate students", isSensitive: true },
    { key: "students.import", realm: "SCHOOL", module: "students", scopes: ["ALL"], personas: ["STAFF"], label: "Import students from a CSV file", isSensitive: true },
] as const;
