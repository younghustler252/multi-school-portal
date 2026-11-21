import { describe, expect, it } from "vitest";
import { fullName, initialsOf, sessionLabel } from "@/lib/people";

describe("fullName", () => {
	it("joins first and last name", () => {
		expect(fullName({ firstName: "Ada", lastName: "Obi" })).toBe("Ada Obi");
	});

	it("skips missing and blank parts", () => {
		expect(fullName({ firstName: "Ada", lastName: null })).toBe("Ada");
		expect(fullName({ firstName: "  ", lastName: "Obi" })).toBe("Obi");
	});

	it("returns the fallback when there is no name", () => {
		expect(fullName({ firstName: null, lastName: null }, "Account")).toBe("Account");
		expect(fullName({})).toBe("");
	});
});

describe("initialsOf", () => {
	it("uses the first letter of each name, upper-cased", () => {
		expect(initialsOf({ firstName: "ada", lastName: "obi" })).toBe("AO");
	});

	it("uses one letter when only one name exists", () => {
		expect(initialsOf({ firstName: "Ada", lastName: null })).toBe("A");
	});

	it("falls back to the fallback text, then to a question mark", () => {
		expect(initialsOf({ firstName: null, lastName: null }, "ada@school.ng")).toBe("A");
		expect(initialsOf({ firstName: null, lastName: null })).toBe("?");
		expect(initialsOf({ firstName: " ", lastName: "" }, "  ")).toBe("?");
	});

	it("keeps a letter outside the basic latin range whole", () => {
		expect(initialsOf({ firstName: "Ọlá", lastName: "Èze" })).toBe("ỌÈ");
	});
});

describe("sessionLabel", () => {
	it("labels each school persona", () => {
		expect(sessionLabel("school", "STAFF")).toBe("Staff");
		expect(sessionLabel("school", "GUARDIAN")).toBe("Guardian");
		expect(sessionLabel("school", "STUDENT")).toBe("Student");
	});

	it("labels a platform session regardless of persona", () => {
		expect(sessionLabel("platform", null)).toBe("Platform admin");
	});

	it("has a neutral label when the persona is not known", () => {
		expect(sessionLabel("school", null)).toBe("Member");
	});
});
