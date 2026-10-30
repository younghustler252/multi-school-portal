/*
| ENROLMENT PERMISSION KEYS.
| enrolment.view     see who is in which class. Scope ALL (everyone), ASSIGNED (a teacher: the classes they lead, and the
|                    classes they teach this term), OWN (a student sees themselves, a guardian sees their children).
|                    BRANCH exists for later and shows nobody until classes are linked to branches.
| enrolment.manage   enrol students, enrol a whole list, move a student to another class, withdraw or re-activate
| enrolment.promote  run the end-of-year promotion (preview and promote)
*/
export const ENROLMENT_PERMISSIONS = [
    { key: "enrolment.view",    realm: "SCHOOL", module: "enrolment", scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View class lists and enrolments" },
    { key: "enrolment.manage",  realm: "SCHOOL", module: "enrolment", scopes: ["ALL"], personas: ["STAFF"], label: "Enrol students and change their class or status", isSensitive: true },
    { key: "enrolment.promote", realm: "SCHOOL", module: "enrolment", scopes: ["ALL"], personas: ["STAFF"], label: "Promote students at the end of the year", isSensitive: true },
] as const;
