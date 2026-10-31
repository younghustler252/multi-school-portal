/*
| REPORT CARD PERMISSION KEYS
| report_cards.view             read report cards. Scope ALL; ASSIGNED = the cards of the classes you LEAD (class teacher); OWN = a student's own or a
|                               guardian's children's, and ONLY once published.
| report_cards.generate         build or rebuild draft cards for a class and write the teacher's remark. Scope ALL, or ASSIGNED = the class teacher.
| report_cards.principal_remark write the principal's remark (ALL).
| report_cards.publish          publish cards (tells guardians) and take them back to draft with a reason (ALL, sensitive).
| The PDF is part of report_cards.view (and needs the plan feature report_cards.pdf).
*/
export const REPORT_CARD_PERMISSIONS = [
    { key: "report_cards.view",             realm: "SCHOOL", module: "report_cards", scopes: ["ALL", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View report cards" },
    { key: "report_cards.generate",         realm: "SCHOOL", module: "report_cards", scopes: ["ALL", "ASSIGNED"], personas: ["STAFF"], label: "Generate report cards and write teacher remarks" },
    { key: "report_cards.principal_remark", realm: "SCHOOL", module: "report_cards", scopes: ["ALL"], personas: ["STAFF"], label: "Write the principal's remark" },
    { key: "report_cards.publish",          realm: "SCHOOL", module: "report_cards", scopes: ["ALL"], personas: ["STAFF"], label: "Publish report cards or take them back", isSensitive: true },
] as const;
