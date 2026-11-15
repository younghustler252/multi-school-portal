import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import { assignmentsWarning, inviteFailureMessage, possibleDuplicateOf } from "@/features/staff/lib/staff-errors";

const err = (code: string, details?: unknown) => new ApiError({ message: "m", status: 409, code, details });

describe("possibleDuplicateOf", () => {
	it("returns the existing record's id for POSSIBLE_DUPLICATE_STAFF", () => {
		expect(possibleDuplicateOf(err("POSSIBLE_DUPLICATE_STAFF", { existingStaffId: "s1" }))).toBe("s1");
	});
	it("still recognises the code when details are missing", () => {
		expect(possibleDuplicateOf(err("POSSIBLE_DUPLICATE_STAFF"))).toBe("");
	});
	it("ignores other errors and non-errors", () => {
		expect(possibleDuplicateOf(err("EMAIL_TAKEN"))).toBeNull();
		expect(possibleDuplicateOf(new Error("x"))).toBeNull();
		expect(possibleDuplicateOf(null)).toBeNull();
	});
});

describe("assignmentsWarning", () => {
	it("is silent when nothing is assigned", () => expect(assignmentsWarning(0)).toBeNull());
	it("pluralises", () => {
		expect(assignmentsWarning(1)).toBe("1 class or subject assignment still needs a new teacher.");
		expect(assignmentsWarning(3)).toBe("3 class or subject assignments still need a new teacher.");
	});
});

describe("inviteFailureMessage", () => {
	it("explains the codes the backend sends and has a safe default", () => {
		expect(inviteFailureMessage("STAFF_HAS_NO_EMAIL")).toMatch(/email/i);
		expect(inviteFailureMessage("ROLE_NOT_ALLOWED")).toMatch(/role/i);
		expect(inviteFailureMessage(undefined)).toMatch(/send it again|invite again|again/i);
	});
});
