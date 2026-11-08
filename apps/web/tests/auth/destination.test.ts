import { describe, expect, it } from "vitest";
import type { MyPermissions } from "@schoolos/contracts";
import { PLATFORM_HOME, resolveDestination, safeReturnTo, SCHOOL_HOME } from "@/lib/auth/destination";
import type { Profile } from "@/lib/auth/session-types";

const base = { id: "u", email: "e@x.y", firstName: null, lastName: null, phone: null, photoUrl: null, isEmailVerified: true, lastLoginAt: null, createdAt: "" };
const school: Profile = { ...base, session: { kind: "school", schoolId: "s", persona: "GUARDIAN", impersonating: false } };
const platform: Profile = { ...base, session: { kind: "platform", schoolId: null, persona: null, impersonating: false } };
const none: MyPermissions = { realm: "school", persona: null, roles: [], holdsEverything: false, permissions: [], branches: { all: [], assigned: [], schoolHasSeveral: false } };

describe("resolveDestination", () => {
	it("sends a platform session to the platform home and a school session to the school home", () => {
		expect(resolveDestination(platform, { ...none, realm: "platform" })).toBe(PLATFORM_HOME);
		expect(resolveDestination(school, none)).toBe(SCHOOL_HOME);
	});

	it("ignores role names: two sessions with different role lists land in the same place", () => {
		expect(resolveDestination(school, { ...none, roles: ["bursar"] })).toBe(resolveDestination(school, { ...none, roles: ["Head of Science (custom)"] }));
	});
});

describe("safeReturnTo", () => {
	it("accepts same-origin paths", () => {
		expect(safeReturnTo("/school-admin/fees?x=1")).toBe("/school-admin/fees?x=1");
	});

	it("rejects anything that could leave the site", () => {
		expect(safeReturnTo("https://evil.test")).toBeNull();
		expect(safeReturnTo("//evil.test")).toBeNull();
		expect(safeReturnTo("/\\evil.test")).toBeNull();
		expect(safeReturnTo("javascript:alert(1)")).toBeNull();
		expect(safeReturnTo("")).toBeNull();
		expect(safeReturnTo(null)).toBeNull();
	});
});
