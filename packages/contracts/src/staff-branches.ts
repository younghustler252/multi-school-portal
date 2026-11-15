/*
| GET /staff/assignable-branches: the branches the signed-in person may place a staff member in (the staff branch picker).
| Permission: staff.manage (not branches.view). Only active branches inside the caller's own staff.manage scope are returned.
| Full contract: docs/backend/modules/staff.md ("Assignable branches").
*/
export interface AssignableBranch {
    id: string;
    name: string;
    code: string;
    isMain: boolean;
}

/** `data` of the response; an empty array is a valid answer. */
export type AssignableBranchesData = AssignableBranch[];
