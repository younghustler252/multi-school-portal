import type { AssignableBranch, SetStaffBranchesDto, StaffBranchRef } from "../types/staff.types";

/*
| Rules around the staff pickers (docs/backend/modules/staff.md). Pure, so they are tested without a screen.
*/

/** Add the id when it isn't there, remove it when it is. */
export function toggleId(ids: string[], id: string): string[] {
	return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Role changes accept 1 to 5 roles (ChangeStaffRolesDto). */
export const MAX_ROLES_PER_STAFF = 5;

export function rolesSelectionProblem(ids: string[]): string | null {
	if (ids.length === 0) return "Choose at least one role.";
	if (ids.length > MAX_ROLES_PER_STAFF) return `Choose at most ${MAX_ROLES_PER_STAFF} roles.`;
	return null;
}

export interface BranchEditState {
	/** Branches the person may place staff in that the staff member already has. */
	selected: string[];
	primary: string | null;
	/** The staff member's branches outside the person's reach. The server keeps them; show them read-only, never as choices. */
	kept: StaffBranchRef[];
}

export function branchEditState(current: StaffBranchRef[], options: AssignableBranch[]): BranchEditState {
	const reach = new Set(options.map((o) => o.id));
	const selected = current.filter((b) => reach.has(b.id)).map((b) => b.id);
	const primaryNow = current.find((b) => b.isPrimary)?.id ?? null;
	return {
		selected,
		primary: primaryNow && selected.includes(primaryNow) ? primaryNow : null,
		kept: current.filter((b) => !reach.has(b.id)),
	};
}

/**
 * The branch change to send, or a problem. At least one branch must remain overall: the ones kept outside the person's
 * reach count, so a branch-limited manager with only kept branches elsewhere may still empty their own list.
 */
export function branchesRequest(selected: string[], primary: string | null, keptCount: number): { dto: SetStaffBranchesDto } | { problem: string } {
	if (selected.length === 0 && keptCount === 0) return { problem: "Choose at least one branch." };
	if (selected.length === 0) return { problem: "Choose at least one branch you manage. Branches you don't manage are kept as they are." };
	return { dto: { branchIds: selected, ...(primary && selected.includes(primary) ? { primaryBranchId: primary } : {}) } };
}

/** branchIds for create-staff. Empty means "let the server choose" (main branch, or the creator's own single branch). */
export function createBranchIds(selected: string[]): { branchIds?: string[] } {
	return selected.length > 0 ? { branchIds: selected } : {};
}

/** A branch-limited manager with several branches must choose; the server rejects an omitted choice for them. */
export function createBranchProblem(opts: { scope: string | null; optionCount: number; selected: string[] }): string | null {
	if (opts.selected.length > 0) return null;
	return opts.scope === "BRANCH" && opts.optionCount > 1 ? "Choose the branch this person works in." : null;
}
