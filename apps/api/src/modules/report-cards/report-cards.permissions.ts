/*
| REPORT CARD PERMISSION KEYS
| report_cards.view             read report cards. Scope ALL; BRANCH = the cards of classes in your branches; ASSIGNED = the cards of the classes you LEAD (class teacher); OWN = a student's own or a
|                               guardian's children's, and ONLY once published.
| report_cards.generate         build or rebuild draft cards for a class and write the teacher's remark. Scope ALL, or ASSIGNED = the class teacher.
| report_cards.principal_remark write the principal's remark (ALL).
| report_cards.publish          publish cards (tells guardians) and take them back to draft with a reason (ALL, sensitive).
| report_cards.publish_incomplete publish a card although some subjects are not published yet (ALL, sensitive). Needs report_cards.publish as well; the
|                               override is explicit (allowMissing) and written to the audit log with the subjects that were missing.
| The PDF is part of report_cards.view (and needs the plan feature report_cards.pdf).
*/
export const REPORT_CARD_PERMISSIONS = [
    { key: "report_cards.view",             realm: "SCHOOL", module: "report_cards", scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF", "STUDENT", "GUARDIAN"], label: "View report cards" },
    { key: "report_cards.generate",         realm: "SCHOOL", module: "report_cards", scopes: ["ALL", "ASSIGNED"], personas: ["STAFF"], label: "Generate report cards and write teacher remarks" },
    { key: "report_cards.principal_remark", realm: "SCHOOL", module: "report_cards", scopes: ["ALL"], personas: ["STAFF"], label: "Write the principal's remark" },
    { key: "report_cards.publish",          realm: "SCHOOL", module: "report_cards", scopes: ["ALL"], personas: ["STAFF"], label: "Publish report cards or take them back", isSensitive: true },
    { key: "report_cards.publish_incomplete", realm: "SCHOOL", module: "report_cards", scopes: ["ALL"], personas: ["STAFF"], label: "Publish report cards with unpublished subjects", isSensitive: true },
] as const;
