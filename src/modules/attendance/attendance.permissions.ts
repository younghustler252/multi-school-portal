/*
| ATTENDANCE PERMISSION KEYS.
| attendance.view      see attendance. Scope ALL (everyone), ASSIGNED (a teacher: the classes they LEAD, and the classes they
|                      TEACH this term), OWN (a student sees their own; a guardian sees their children's).
|                      BRANCH exists for later and shows nobody until classes are linked to branches.
| attendance.mark      take the class register. Scope ALL (any class) or ASSIGNED (the classes you LEAD, or TEACH in the
|                      term of the date; last term's assignment gives nothing).
| attendance.override  correct a mark AFTER the edit window has closed (sensitive).
*/
export const ATTENDANCE_PERMISSIONS = [
    { key: "attendance.view",     realm: "SCHOOL", module: "attendance", scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View attendance" },
    { key: "attendance.mark",     realm: "SCHOOL", module: "attendance", scopes: ["ALL", "ASSIGNED"], personas: ["STAFF"], label: "Take the class register" },
    { key: "attendance.override", realm: "SCHOOL", module: "attendance", scopes: ["ALL"], personas: ["STAFF"], label: "Correct attendance after the edit window", isSensitive: true },
] as const;
