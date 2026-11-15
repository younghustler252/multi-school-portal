/*
| GET /staff/assignable-roles: the roles the signed-in person may hand out when inviting a staff member or changing their roles.
| Permission: staff.manage (not roles.view). Only roles the caller could really grant are returned; the rest are left out.
| Full contract: docs/backend/modules/staff.md ("Assignable roles").
*/
export type StaffRoleKind = "SYSTEM_LOCKED" | "SYSTEM_EDITABLE" | "CUSTOM";

export interface AssignableStaffRole {
    id: string;
    name: string;
    description: string | null;
    kind: StaffRoleKind;
    /** Holds every permission (the School Admin role). Only a School Admin is ever offered one. */
    grantsAll: boolean;
}

/** `data` of the response; an empty array is a valid answer. */
export type AssignableStaffRolesData = AssignableStaffRole[];
