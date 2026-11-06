import { describe, expect, it } from "vitest";
import { accessOf, ErrorCodes, type MyPermissions } from "@schoolos/contracts";

/*
| The web app reads GET /users/me/permissions through the shared contract (packages/contracts/src/me-permissions.ts).
| These tests pin the helper's behaviour and prove @schoolos/contracts resolves from the web app.
*/

const main = { id: "b-main", name: "Main campus", isMain: true };
const north = { id: "b-north", name: "North campus", isMain: false };

function me(overrides: Partial<MyPermissions> = {}): MyPermissions {
	return {
		realm: "school",
		persona: "STAFF",
		roles: ["teacher"],
		holdsEverything: false,
		permissions: [
			{ key: "students.view", scope: "ALL" },
			{ key: "attendance.view", scope: "BRANCH" },
			{ key: "grades.enter", scope: "ASSIGNED" },
			{ key: "payroll.payslips.view", scope: "OWN" },
		],
		branches: { all: [main, north], assigned: [north], schoolHasSeveral: true },
		...overrides,
	};
}

describe("accessOf", () => {
	it("can() is true only for held permissions, at any scope", () => {
		const a = accessOf(me());
		expect(a.can("students.view")).toBe(true);
		expect(a.can("payroll.payslips.view")).toBe(true);
		expect(a.can("fees.refund")).toBe(false);
	});

	it("scopeOf() returns the held scope, or null", () => {
		const a = accessOf(me());
		expect(a.scopeOf("attendance.view")).toBe("BRANCH");
		expect(a.scopeOf("fees.refund")).toBeNull();
	});

	it("canAtLeast() orders scopes ALL > BRANCH > ASSIGNED > OWN", () => {
		const a = accessOf(me());
		expect(a.canAtLeast("students.view", "BRANCH")).toBe(true); // held ALL
		expect(a.canAtLeast("attendance.view", "ALL")).toBe(false); // held BRANCH
		expect(a.canAtLeast("grades.enter", "OWN")).toBe(true); // held ASSIGNED
		expect(a.canAtLeast("payroll.payslips.view", "ASSIGNED")).toBe(false); // held OWN
		expect(a.canAtLeast("fees.refund", "OWN")).toBe(false); // not held
	});

	it("canAny() is true when at least one key is held", () => {
		const a = accessOf(me());
		expect(a.canAny("fees.refund", "grades.enter")).toBe(true);
		expect(a.canAny("fees.refund", "payments.settle")).toBe(false);
		expect(a.canAny()).toBe(false);
	});

	it("branchChoices() offers every branch for ALL, only the assigned ones for BRANCH, none otherwise", () => {
		const a = accessOf(me());
		expect(a.branchChoices("students.view")).toEqual([main, north]);
		expect(a.branchChoices("attendance.view")).toEqual([north]);
		expect(a.branchChoices("grades.enter")).toEqual([]);
		expect(a.branchChoices("fees.refund")).toEqual([]);
	});

	it("branchChoices() is empty everywhere when the school has a single branch", () => {
		const a = accessOf(me({ branches: { all: [main], assigned: [main], schoolHasSeveral: false } }));
		expect(a.branchChoices("students.view")).toEqual([]);
		expect(a.branchChoices("attendance.view")).toEqual([]);
	});
});

describe("@schoolos/contracts", () => {
	it("exports the stable error codes the web app switches on", () => {
		expect(ErrorCodes.ROLE_NOT_ALLOWED).toBe("ROLE_NOT_ALLOWED");
	});
});
