import { describe, expect, it } from "vitest";
import { branchEditState, branchesRequest, createBranchIds, createBranchProblem, rolesSelectionProblem, toggleId } from "@/features/staff/lib/staff-pickers";
import type { AssignableBranch, StaffBranchRef } from "@/features/staff/types/staff.types";

const opt = (id: string, isMain = false): AssignableBranch => ({ id, name: id, code: id.toUpperCase(), isMain });
const ref = (id: string, isPrimary = false): StaffBranchRef => ({ id, name: id, code: id.toUpperCase(), isPrimary });

describe("toggleId and roles", () => {
	it("adds and removes", () => {
		expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
		expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
	});
	it("allows 1 to 5 roles", () => {
		expect(rolesSelectionProblem([])).toMatch(/at least one/);
		expect(rolesSelectionProblem(["a"])).toBeNull();
		expect(rolesSelectionProblem(["a", "b", "c", "d", "e", "f"])).toMatch(/at most 5/);
	});
});

describe("branchEditState", () => {
	it("selects what the person can manage and keeps the rest read-only", () => {
		const s = branchEditState([ref("a", true), ref("b"), ref("z")], [opt("a"), opt("b"), opt("c")]);
		expect(s.selected).toEqual(["a", "b"]);
		expect(s.primary).toBe("a");
		expect(s.kept.map((b) => b.id)).toEqual(["z"]);
	});
	it("has no primary when the primary branch is outside the person's reach", () => {
		const s = branchEditState([ref("z", true), ref("a")], [opt("a")]);
		expect(s.primary).toBeNull();
		expect(s.selected).toEqual(["a"]);
	});
});

describe("branchesRequest", () => {
	it("sends the selection with a primary that is selected", () => {
		expect(branchesRequest(["a", "b"], "b", 0)).toEqual({ dto: { branchIds: ["a", "b"], primaryBranchId: "b" } });
		expect(branchesRequest(["a"], "zzz", 0)).toEqual({ dto: { branchIds: ["a"] } });
	});
	it("refuses an empty result", () => {
		expect(branchesRequest([], null, 0)).toEqual({ problem: "Choose at least one branch." });
		expect(branchesRequest([], null, 2)).toMatchObject({ problem: expect.stringMatching(/you manage/) });
	});
});

describe("create-staff branches", () => {
	it("omits branchIds when nothing is chosen so the server picks", () => {
		expect(createBranchIds([])).toEqual({});
		expect(createBranchIds(["a"])).toEqual({ branchIds: ["a"] });
	});
	it("makes a branch-scoped manager with several branches choose", () => {
		expect(createBranchProblem({ scope: "BRANCH", optionCount: 3, selected: [] })).toMatch(/Choose/);
		expect(createBranchProblem({ scope: "BRANCH", optionCount: 1, selected: [] })).toBeNull();
		expect(createBranchProblem({ scope: "ALL", optionCount: 3, selected: [] })).toBeNull();
		expect(createBranchProblem({ scope: "BRANCH", optionCount: 3, selected: ["a"] })).toBeNull();
	});
});
