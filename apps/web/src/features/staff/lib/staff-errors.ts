import { isApiError } from "@/lib/api/api-error";

/*
| Staff-specific API errors the screens react to (docs/backend/modules/staff.md section 8).
*/

/** When create answers POSSIBLE_DUPLICATE_STAFF, the id of the record that looks the same; otherwise null. */
export function possibleDuplicateOf(err: unknown): string | null {
	if (!isApiError(err) || err.code !== "POSSIBLE_DUPLICATE_STAFF") return null;
	const details = err.details as { existingStaffId?: unknown } | undefined;
	return typeof details?.existingStaffId === "string" ? details.existingStaffId : "";
}

/** One sentence for the follow-up after deactivating someone who still teaches. null when nothing needs doing. */
export function assignmentsWarning(activeAssignments: number): string | null {
	if (activeAssignments <= 0) return null;
	const what = activeAssignments === 1 ? "1 class or subject assignment still needs" : `${activeAssignments} class or subject assignments still need`;
	return `${what} a new teacher.`;
}

/** Why an invitation sent with a new staff record did not go out. The staff record itself exists. */
export function inviteFailureMessage(code: string | undefined): string {
	switch (code) {
		case "STAFF_HAS_NO_EMAIL": return "Add an email address, then send the invitation again.";
		case "ROLE_NOT_ALLOWED": return "You can't give that role. Choose another and invite again.";
		default: return "The invitation wasn't sent. You can send it again from the staff profile.";
	}
}
