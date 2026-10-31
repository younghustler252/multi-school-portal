/*
| GRADES PERMISSION KEYS
| grades.view    read the grading scales and assessment schemes. Scope ALL / BRANCH / ASSIGNED / OWN (the scope matters
|                for results, which come with the mark-sheet pass; setup is the same for everyone who may read it).
| grades.config  change the scales and schemes (ALL). A custom SCALE also needs the plan feature `grading.custom`.
| grades.enter   enter and change scores on a draft mark sheet. Scope ALL, or ASSIGNED = the teacher of THAT subject in that class.
| grades.submit  send a finished draft to be reviewed (same scope as grades.enter).
| grades.approve approve a submitted sheet, or send a submitted / approved sheet back to draft (ALL).
| grades.publish publish an approved sheet, and lock a published one (ALL).
| grades.reopen  take a published or locked sheet back to draft, with a reason (ALL, sensitive).
*/
export const GRADES_PERMISSIONS = [
    { key: "grades.view",   realm: "SCHOOL", module: "grades", scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View grades and the grading setup" },
    { key: "grades.enter",   realm: "SCHOOL", module: "grades", scopes: ["ALL", "ASSIGNED"], personas: ["STAFF"], label: "Enter scores on a mark sheet" },
    { key: "grades.submit",  realm: "SCHOOL", module: "grades", scopes: ["ALL", "ASSIGNED"], personas: ["STAFF"], label: "Submit a mark sheet for approval" },
    { key: "grades.approve", realm: "SCHOOL", module: "grades", scopes: ["ALL"], personas: ["STAFF"], label: "Approve mark sheets" },
    { key: "grades.publish", realm: "SCHOOL", module: "grades", scopes: ["ALL"], personas: ["STAFF"], label: "Publish and lock mark sheets" },
    { key: "grades.reopen",  realm: "SCHOOL", module: "grades", scopes: ["ALL"], personas: ["STAFF"], label: "Reopen a published mark sheet", isSensitive: true },
    { key: "grades.config", realm: "SCHOOL", module: "grades", scopes: ["ALL"], personas: ["STAFF"], label: "Change grading scales and assessment schemes" },
] as const;
