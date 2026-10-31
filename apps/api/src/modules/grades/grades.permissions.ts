/*
| GRADES PERMISSION KEYS (this pass: setup. The mark-sheet keys are added with the mark-sheet pass.)
| grades.view    read the grading scales and assessment schemes. Scope ALL / BRANCH / ASSIGNED / OWN (the scope matters
|                for results, which come with the mark-sheet pass; setup is the same for everyone who may read it).
| grades.config  change the scales and schemes (ALL). A custom SCALE also needs the plan feature `grading.custom`.
*/
export const GRADES_PERMISSIONS = [
    { key: "grades.view",   realm: "SCHOOL", module: "grades", scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View grades and the grading setup" },
    { key: "grades.config", realm: "SCHOOL", module: "grades", scopes: ["ALL"], personas: ["STAFF"], label: "Change grading scales and assessment schemes" },
] as const;
