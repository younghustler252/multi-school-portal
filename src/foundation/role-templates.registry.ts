import type { Persona, Scope } from "./permissions.registry";

/*
|--------------------------------------------------------------------------
| ROLE TEMPLATES (starting data for every new school)
| Roles are DATA: platform staff edit templates in the console and every school gets its own copy when
| it is built (the provisioning worker copies the templates into the school). This file only supplies the
| FIRST version, and a few locked ones the system cannot work without.
|
|  LOCKED  (school_admin, student, guardian): the sync enforces their locked / all-access / default-for-persona
|          settings on every deploy, so nobody can accidentally weaken them. Their permission lists are never touched.
|  EDITABLE (principal, teacher, bursar): created once with the grants below, then owned by the platform.
|          The sync never overwrites them. Each module pass adds the keys it introduces.
|--------------------------------------------------------------------------
*/

export interface RoleTemplateDef {
    key:               string;
    name:              string;
    description:       string;
    persona:           Persona;
    locked:            boolean;
    grantsAll:         boolean;
    defaultForPersona?: Persona;
    sortOrder:         number;
    permissions:       { key: string; scope: Scope }[];
}

export const ROLE_TEMPLATES: RoleTemplateDef[] = [
    {
        key: "school_admin", name: "School Admin", persona: "STAFF", locked: true, grantsAll: true, sortOrder: 0,
        description: "Full access to everything in the school. Cannot be edited or deleted.",
        permissions: [],
    },
    {
        key: "principal", name: "Principal", persona: "STAFF", locked: false, grantsAll: false, sortOrder: 10,
        description: "Oversees the whole school: profile, people, attendance and fees (view).",
        permissions: [
            { key: "school.view", scope: "ALL" }, { key: "school.update", scope: "ALL" }, { key: "school.dashboard.view", scope: "ALL" },
            { key: "students.view", scope: "ALL" }, { key: "attendance.view", scope: "ALL" },
            { key: "fees.view", scope: "ALL" }, { key: "fees.setup.view", scope: "ALL" }, { key: "fees.invoices.view", scope: "ALL" }, { key: "staff.view", scope: "ALL" },
            { key: "branches.view", scope: "ALL" },
            { key: "finance.accounts.view", scope: "ALL" }, { key: "finance.journals.view", scope: "ALL" }, { key: "finance.periods.view", scope: "ALL" }, { key: "finance.reports.view", scope: "ALL" },
        ],
    },
    {
        key: "branch_principal", name: "Branch Principal", persona: "STAFF", locked: false, grantsAll: false, sortOrder: 15,
        description: "Runs one campus: sees only the branches they are assigned to.",
        permissions: [
            { key: "school.view", scope: "ALL" }, { key: "branches.view", scope: "BRANCH" },
            { key: "students.view", scope: "BRANCH" }, { key: "attendance.view", scope: "BRANCH" },
            { key: "fees.view", scope: "BRANCH" }, { key: "staff.view", scope: "BRANCH" }, { key: "staff.manage", scope: "BRANCH" },
        ],
    },
    {
        key: "teacher", name: "Teacher", persona: "STAFF", locked: false, grantsAll: false, sortOrder: 20,
        description: "Works with the students and classes assigned to them.",
        permissions: [
            { key: "school.view", scope: "ALL" },
            { key: "students.view", scope: "ASSIGNED" }, { key: "attendance.view", scope: "ASSIGNED" },
        ],
    },
    {
        key: "bursar", name: "Bursar", persona: "STAFF", locked: false, grantsAll: false, sortOrder: 30,
        description: "Handles fees, invoices and payments, and views the books and finance reports.",
        permissions: [
            { key: "school.view", scope: "ALL" }, { key: "school.dashboard.view", scope: "ALL" },
            { key: "students.view", scope: "ALL" }, { key: "fees.view", scope: "ALL" },
            { key: "fees.setup.view", scope: "ALL" }, { key: "fees.types.manage", scope: "ALL" }, { key: "fees.structures.manage", scope: "ALL" },
            { key: "fees.invoices.view", scope: "ALL" }, { key: "fees.invoices.create", scope: "ALL" }, { key: "fees.invoices.issue", scope: "ALL" },
            { key: "finance.accounts.view", scope: "ALL" }, { key: "finance.journals.view", scope: "ALL" }, { key: "finance.periods.view", scope: "ALL" }, { key: "finance.reports.view", scope: "ALL" },
        ],
    },
    {
        key: "student", name: "Student", persona: "STUDENT", locked: true, grantsAll: false, defaultForPersona: "STUDENT", sortOrder: 100,
        description: "A student's own records only. Assigned automatically.",
        permissions: [
            { key: "students.view", scope: "OWN" }, { key: "attendance.view", scope: "OWN" }, { key: "fees.view", scope: "OWN" },
        ],
    },
    {
        key: "guardian", name: "Guardian", persona: "GUARDIAN", locked: true, grantsAll: false, defaultForPersona: "GUARDIAN", sortOrder: 110,
        description: "The records of the guardian's own children only. Assigned automatically.",
        permissions: [
            { key: "students.view", scope: "OWN" }, { key: "attendance.view", scope: "OWN" }, { key: "fees.view", scope: "OWN" },
        ],
    },
];
