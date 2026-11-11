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

type Persona = "STAFF" | "GUARDIAN" | "STUDENT";
const as = (persona: Persona, entries: [string, "ALL" | "BRANCH" | "ASSIGNED" | "OWN"][]): MyPermissions => ({
	...me([]), persona, permissions: entries.map(([key, scope]) => ({ key, scope })),
});

describe("guardian and student pages", () => {
	const guardian = as("GUARDIAN", [["students.view", "OWN"], ["fees.view", "OWN"], ["payments.pay", "OWN"], ["report_cards.view", "OWN"]]);
	const student = as("STUDENT", [["attendance.view", "OWN"], ["grades.view", "OWN"], ["report_cards.view", "OWN"], ["fees.view", "OWN"]]);

	it("a guardian session can open the guardian pages, including a child's detail page", () => {
		for (const p of ["/guardian/children", "/guardian/children/42", "/guardian/fees", "/guardian/payments", "/guardian/report-card"]) {
			expect(canOpenRoute(p, guardian)).toBe(true);
		}
	});

	it("a student session can open the student pages", () => {
		for (const p of ["/student/attendance", "/student/grades", "/student/report-cards"]) expect(canOpenRoute(p, student)).toBe(true);
	});

	it("persona must match: guardian pages are not for a student session and the reverse, even with the same keys at OWN", () => {
		expect(canOpenRoute("/guardian/report-card", student)).toBe(false);
		expect(canOpenRoute("/guardian/fees", student)).toBe(false);
		expect(canOpenRoute("/guardian/payments", student)).toBe(false);
		expect(canOpenRoute("/student/report-cards", guardian)).toBe(false);
	});

	it("a STAFF session never gets the self-service pages, whatever scope it holds", () => {
		const own = as("STAFF", [["students.view", "OWN"], ["grades.view", "OWN"]]);
		const all = as("STAFF", [["students.view", "ALL"], ["fees.view", "ALL"], ["grades.view", "ALL"]]);
		for (const who of [own, all]) {
			expect(canOpenRoute("/guardian/children", who)).toBe(false);
			expect(canOpenRoute("/student/grades", who)).toBe(false);
		}
	});

	it("scope must be exactly OWN even for the right persona", () => {
		expect(canOpenRoute("/guardian/children", as("GUARDIAN", [["students.view", "ALL"]]))).toBe(false);
		expect(canOpenRoute("/student/grades", as("STUDENT", [["grades.view", "ASSIGNED"]]))).toBe(false);
	});

	it("each page asks for its own permission", () => {
		expect(canOpenRoute("/student/attendance", as("STUDENT", [["grades.view", "OWN"]]))).toBe(false);
		expect(canOpenRoute("/guardian/report-card", as("GUARDIAN", [["fees.view", "OWN"]]))).toBe(false);
	});

	it("the own inbox and the student dashboard have no permission rule", () => {
		expect(canOpenRoute("/guardian/notifications", as("GUARDIAN", []))).toBe(true);
		expect(canOpenRoute("/student/dashboard", as("STUDENT", []))).toBe(true);
	});
});

describe("principal, teacher and bursar pages", () => {
	it("principal pages need the permission at ALL", () => {
		expect(canOpenRoute("/principal/overview", as("STAFF", [["school.dashboard.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute("/principal/overview", as("STAFF", [["school.dashboard.view", "BRANCH"]]))).toBe(false);
		expect(canOpenRoute("/principal/attendance", as("STAFF", [["attendance.view", "ASSIGNED"]]))).toBe(false);
		expect(canOpenRoute("/principal/grades", as("STAFF", [["grades.view", "ALL"]]))).toBe(true);
	});

	it("teacher attendance and grades: either permission, ASSIGNED or broader", () => {
		expect(canOpenRoute("/teacher/attendance", as("STAFF", [["attendance.mark", "ASSIGNED"]]))).toBe(true);
		expect(canOpenRoute("/teacher/attendance", as("STAFF", [["attendance.view", "ASSIGNED"]]))).toBe(true);
		expect(canOpenRoute("/teacher/attendance", as("STAFF", [["attendance.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute("/teacher/attendance", as("STAFF", [["attendance.view", "OWN"]]))).toBe(false);
		expect(canOpenRoute("/teacher/grades", as("STAFF", [["grades.enter", "ASSIGNED"]]))).toBe(true);
		expect(canOpenRoute("/teacher/grades", as("STAFF", [["grades.submit", "ASSIGNED"]]))).toBe(false);
	});

	it("teacher dashboard, classes and report cards", () => {
		expect(canOpenRoute("/teacher/dashboard", as("STAFF", [["classes.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute("/teacher/my-classes", as("STAFF", [["classes.view", "ASSIGNED"]]))).toBe(false);
		expect(canOpenRoute("/teacher/report-cards", as("STAFF", [["report_cards.view", "ASSIGNED"]]))).toBe(true);
	});

	it("bursar pages", () => {
		expect(canOpenRoute("/bursar/dashboard", as("STAFF", [["school.dashboard.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute("/bursar/fees", as("STAFF", [["fees.setup.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute("/bursar/fees", as("STAFF", [["fees.view", "ALL"]]))).toBe(false);
		expect(canOpenRoute("/bursar/payments", as("STAFF", [["payments.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute("/bursar/payments", as("STAFF", [["payments.record", "ALL"]]))).toBe(false);
	});

	it("viewing never depends on an action permission, and the teacher inbox has no rule", () => {
		expect(canOpenRoute("/teacher/notifications", as("STAFF", []))).toBe(true);
		expect(canOpenRoute("/bursar/payments", as("STAFF", [["payments.view", "ALL"], ["payments.record", "ALL"]]))).toBe(true);
	});

	it("no role names: the same permissions give the same answer whatever the roles are called", () => {
		const a = { ...as("STAFF", [["payments.view", "ALL"]]), roles: ["bursar"] };
		const b = { ...as("STAFF", [["payments.view", "ALL"]]), roles: ["anything"] };
		expect(canOpenRoute("/bursar/payments", a)).toBe(canOpenRoute("/bursar/payments", b));
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
