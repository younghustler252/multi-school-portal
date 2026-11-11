import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MyPermissions } from "@schoolos/contracts";
import { canOpenRoute, PLATFORM_ROUTE_RULES, ruleFor, SCHOOL_ROUTE_RULES } from "@/lib/route-access";
import { PLATFORM_NAV, SCHOOL_NAV } from "@/lib/nav-model";

function me(keys: string[], realm: "school" | "platform" = "school"): MyPermissions {
	return {
		realm, persona: realm === "school" ? "STAFF" : null, roles: [], holdsEverything: false,
		permissions: keys.map((key) => ({ key, scope: "ALL" as const })),
		branches: { all: [], assigned: [], schoolHasSeveral: false },
	};
}

describe("canOpenRoute", () => {
	it("denies everything until permissions are loaded", () => {
		expect(canOpenRoute("/home", null)).toBe(false);
	});

	it("a page with no rule is open (the API stays the authority)", () => {
		expect(canOpenRoute("/home", me([]))).toBe(true);
		expect(canOpenRoute("/settings", me([]))).toBe(true);
	});

	it("needs ANY listed permission", () => {
		expect(canOpenRoute("/school-admin/attendance", me(["attendance.mark"]))).toBe(true);
		expect(canOpenRoute("/school-admin/attendance", me(["grades.view"]))).toBe(false);
	});

	it("the most specific rule wins: creating needs manage, listing needs view", () => {
		const viewer = me(["staff.view"]);
		expect(canOpenRoute("/school-admin/staff", viewer)).toBe(true);
		expect(canOpenRoute("/school-admin/staff/abc", viewer)).toBe(true);
		expect(canOpenRoute("/school-admin/staff/new", viewer)).toBe(false);
		expect(canOpenRoute("/school-admin/staff/new", me(["staff.manage"]))).toBe(true);
	});

	it("matches whole segments only", () => {
		expect(ruleFor("/school-admin/staffing", SCHOOL_ROUTE_RULES)).toBeNull();
		expect(ruleFor("/school-admin/staff/", SCHOOL_ROUTE_RULES)?.path).toBe("/school-admin/staff");
	});

	it("uses the platform table for platform sessions", () => {
		expect(canOpenRoute("/schools/1", me(["platform.schools.view"], "platform"))).toBe(true);
		expect(canOpenRoute("/plans", me(["platform.schools.view"], "platform"))).toBe(false);
	});

	it("role names play no part", () => {
		const a = { ...me(["fees.invoices.view"]), roles: ["bursar"] };
		const b = { ...me([]), roles: ["bursar"] };
		expect(canOpenRoute("/school-admin/fees", a)).toBe(true);
		expect(canOpenRoute("/school-admin/fees", b)).toBe(false);
	});
});

describe("guardian and student pages", () => {
	const as = (entries: [string, "ALL" | "OWN" | "BRANCH"][]): MyPermissions => ({
		...me([]), permissions: entries.map(([key, scope]) => ({ key, scope })),
	});
	const guardian = as([["students.view", "OWN"], ["fees.view", "OWN"], ["payments.pay", "OWN"], ["report_cards.view", "OWN"]]);
	const student = as([["attendance.view", "OWN"], ["grades.view", "OWN"], ["report_cards.view", "OWN"], ["fees.view", "OWN"]]);

	it("a guardian can open the guardian pages, including a child's detail page", () => {
		for (const p of ["/guardian/children", "/guardian/children/42", "/guardian/fees", "/guardian/payments", "/guardian/report-card"]) {
			expect(canOpenRoute(p, guardian)).toBe(true);
		}
	});

	it("a student can open the student pages but not pay (payments.pay is guardian-only)", () => {
		for (const p of ["/student/attendance", "/student/grades", "/student/report-cards"]) expect(canOpenRoute(p, student)).toBe(true);
		expect(canOpenRoute("/guardian/payments", student)).toBe(false);
	});

	it("needs the permission at OWN scope: a staff member with ALL scope does not get the 'my' pages", () => {
		const staff = as([["students.view", "ALL"], ["fees.view", "ALL"], ["grades.view", "ALL"]]);
		expect(canOpenRoute("/guardian/children", staff)).toBe(false);
		expect(canOpenRoute("/guardian/fees", staff)).toBe(false);
		expect(canOpenRoute("/student/grades", staff)).toBe(false);
	});

	it("each page asks for its own permission", () => {
		expect(canOpenRoute("/student/attendance", as([["grades.view", "OWN"]]))).toBe(false);
		expect(canOpenRoute("/guardian/report-card", as([["fees.view", "OWN"]]))).toBe(false);
	});

	it("the own inbox and the student dashboard have no permission rule", () => {
		expect(canOpenRoute("/guardian/notifications", me([]))).toBe(true);
		expect(canOpenRoute("/student/dashboard", me([]))).toBe(true);
		expect(canOpenRoute("/student/dashboard", as([["school.dashboard.view", "ALL"]]))).toBe(true);
	});
});

describe("menu and pages agree", () => {
	const appDir = fileURLToPath(new URL("../../src/app", import.meta.url));
	const pageExists = (to: string, group: string) => existsSync(join(appDir, group, ...to.split("/").filter(Boolean), "page.tsx"));

	it("every school menu link opens a real page", () => {
		for (const e of SCHOOL_NAV) expect(pageExists(e.to, "(dashboard)")).toBe(true);
	});

	it("every platform menu link opens a real page", () => {
		for (const e of PLATFORM_NAV) expect(pageExists(e.to, "(super-admin)")).toBe(true);
	});

	it("every menu entry that needs a permission has a matching route rule", () => {
		for (const e of SCHOOL_NAV.filter((n) => n.anyOf)) {
			expect(ruleFor(e.to, SCHOOL_ROUTE_RULES)?.anyOf).toEqual(e.anyOf);
		}
		for (const e of PLATFORM_NAV.filter((n) => n.anyOf)) {
			expect(ruleFor(e.to, PLATFORM_ROUTE_RULES)?.anyOf).toEqual(e.anyOf);
		}
	});
});
