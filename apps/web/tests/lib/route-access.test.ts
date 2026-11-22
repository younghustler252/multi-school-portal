import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MyPermissions } from "@schoolos/contracts";
import { canOpenRoute, PLATFORM_ROUTE_RULES, ruleFor, SCHOOL_ROUTE_RULES } from "@/lib/route-access";
import { PLATFORM_NAV, SCHOOL_NAV } from "@/lib/nav-model";
import { ROUTES } from "@/lib/routes";

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
		expect(canOpenRoute(ROUTES.school.attendance, me(["attendance.mark"]))).toBe(true);
		expect(canOpenRoute(ROUTES.school.attendance, me(["grades.view"]))).toBe(false);
	});

	it("the most specific rule wins: creating needs manage, listing needs view", () => {
		const viewer = me(["staff.view"]);
		expect(canOpenRoute(ROUTES.school.staff.list, viewer)).toBe(true);
		expect(canOpenRoute(ROUTES.school.staff.detail("abc"), viewer)).toBe(true);
		expect(canOpenRoute(ROUTES.school.staff.new, viewer)).toBe(false);
		expect(canOpenRoute(ROUTES.school.staff.new, me(["staff.manage"]))).toBe(true);
	});

	it("matches whole segments only", () => {
		expect(ruleFor("/school/staffing", SCHOOL_ROUTE_RULES)).toBeNull();
		expect(ruleFor(ROUTES.school.staff.list + "/", SCHOOL_ROUTE_RULES)?.path).toBe(ROUTES.school.staff.list);
	});

	it("uses the platform table for platform sessions", () => {
		expect(canOpenRoute("/schools/1", me(["platform.schools.view"], "platform"))).toBe(true);
		expect(canOpenRoute("/plans", me(["platform.schools.view"], "platform"))).toBe(false);
	});

	it("role names play no part", () => {
		const a = { ...me(["fees.invoices.view"]), roles: ["bursar"] };
		const b = { ...me([]), roles: ["bursar"] };
		expect(canOpenRoute(ROUTES.school.fees.list, a)).toBe(true);
		expect(canOpenRoute(ROUTES.school.fees.list, b)).toBe(false);
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
		for (const p of [ROUTES.family.children.list, ROUTES.family.children.detail(42), ROUTES.family.fees, ROUTES.family.payments, ROUTES.family.reportCards]) {
			expect(canOpenRoute(p, guardian)).toBe(true);
		}
	});

	it("a student session can open the student pages", () => {
		for (const p of [ROUTES.learning.attendance, ROUTES.learning.grades, ROUTES.learning.reportCards, ROUTES.learning.fees]) expect(canOpenRoute(p, student)).toBe(true);
	});

	it("persona must match: guardian pages are not for a student session and the reverse, even with the same keys at OWN", () => {
		expect(canOpenRoute(ROUTES.family.reportCards, student)).toBe(false);
		expect(canOpenRoute(ROUTES.family.fees, student)).toBe(false);
		expect(canOpenRoute(ROUTES.family.payments, student)).toBe(false);
		expect(canOpenRoute(ROUTES.learning.reportCards, guardian)).toBe(false);
		expect(canOpenRoute(ROUTES.learning.fees, guardian)).toBe(false);
	});

	it("the statement page follows the fees page rule, and payments stay guardian-only", () => {
		expect(canOpenRoute(ROUTES.family.statement, guardian)).toBe(true);
		expect(canOpenRoute(ROUTES.family.statement, student)).toBe(false);
		expect(canOpenRoute(ROUTES.family.payments, student)).toBe(false);
	});

	it("a STAFF session never gets the self-service pages, whatever scope it holds", () => {
		const own = as("STAFF", [["students.view", "OWN"], ["grades.view", "OWN"]]);
		const all = as("STAFF", [["students.view", "ALL"], ["fees.view", "ALL"], ["grades.view", "ALL"]]);
		for (const who of [own, all]) {
			expect(canOpenRoute(ROUTES.family.children.list, who)).toBe(false);
			expect(canOpenRoute(ROUTES.learning.grades, who)).toBe(false);
		}
	});

	it("scope must be exactly OWN even for the right persona", () => {
		expect(canOpenRoute(ROUTES.family.children.list, as("GUARDIAN", [["students.view", "ALL"]]))).toBe(false);
		expect(canOpenRoute(ROUTES.learning.grades, as("STUDENT", [["grades.view", "ASSIGNED"]]))).toBe(false);
	});

	it("each page asks for its own permission", () => {
		expect(canOpenRoute(ROUTES.learning.attendance, as("STUDENT", [["grades.view", "OWN"]]))).toBe(false);
		expect(canOpenRoute(ROUTES.family.reportCards, as("GUARDIAN", [["fees.view", "OWN"]]))).toBe(false);
	});

	it("the own inbox and the student dashboard have no permission rule", () => {
		expect(canOpenRoute(ROUTES.family.notifications, as("GUARDIAN", []))).toBe(true);
		expect(canOpenRoute(ROUTES.learning.dashboard, as("STUDENT", []))).toBe(true);
	});
});

describe("principal, teacher and bursar pages", () => {
	it("principal pages need the permission at ALL", () => {
		expect(canOpenRoute(ROUTES.insights.overview, as("STAFF", [["school.dashboard.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.insights.overview, as("STAFF", [["school.dashboard.view", "BRANCH"]]))).toBe(false);
		expect(canOpenRoute(ROUTES.insights.attendance, as("STAFF", [["attendance.view", "ASSIGNED"]]))).toBe(false);
		expect(canOpenRoute(ROUTES.insights.grades, as("STAFF", [["grades.view", "ALL"]]))).toBe(true);
	});

	it("teacher attendance and grades: either permission, ASSIGNED or broader", () => {
		expect(canOpenRoute(ROUTES.teaching.attendance, as("STAFF", [["attendance.mark", "ASSIGNED"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.teaching.attendance, as("STAFF", [["attendance.view", "ASSIGNED"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.teaching.attendance, as("STAFF", [["attendance.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.teaching.attendance, as("STAFF", [["attendance.view", "OWN"]]))).toBe(false);
		expect(canOpenRoute(ROUTES.teaching.grades, as("STAFF", [["grades.enter", "ASSIGNED"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.teaching.grades, as("STAFF", [["grades.submit", "ASSIGNED"]]))).toBe(false);
	});

	it("teacher dashboard, classes and report cards", () => {
		expect(canOpenRoute(ROUTES.teaching.dashboard, as("STAFF", [["classes.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.teaching.classes, as("STAFF", [["classes.view", "ASSIGNED"]]))).toBe(false);
		expect(canOpenRoute(ROUTES.teaching.reportCards, as("STAFF", [["report_cards.view", "ASSIGNED"]]))).toBe(true);
	});

	it("bursar pages", () => {
		expect(canOpenRoute(ROUTES.finance.dashboard, as("STAFF", [["school.dashboard.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.finance.fees, as("STAFF", [["fees.setup.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.finance.fees, as("STAFF", [["fees.view", "ALL"]]))).toBe(false);
		expect(canOpenRoute(ROUTES.finance.payments, as("STAFF", [["payments.view", "ALL"]]))).toBe(true);
		expect(canOpenRoute(ROUTES.finance.payments, as("STAFF", [["payments.record", "ALL"]]))).toBe(false);
	});

	it("viewing never depends on an action permission, and the teacher inbox has no rule", () => {
		expect(canOpenRoute(ROUTES.teaching.notifications, as("STAFF", []))).toBe(true);
		expect(canOpenRoute(ROUTES.finance.payments, as("STAFF", [["payments.view", "ALL"], ["payments.record", "ALL"]]))).toBe(true);
	});

	it("no role names: the same permissions give the same answer whatever the roles are called", () => {
		const a = { ...as("STAFF", [["payments.view", "ALL"]]), roles: ["bursar"] };
		const b = { ...as("STAFF", [["payments.view", "ALL"]]), roles: ["anything"] };
		expect(canOpenRoute(ROUTES.finance.payments, a)).toBe(canOpenRoute(ROUTES.finance.payments, b));
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

	it("every menu entry is backed by the same rule the guard uses", () => {
		for (const e of SCHOOL_NAV) expect(ruleFor(e.to, SCHOOL_ROUTE_RULES)).toBe(e.rule);
		for (const e of PLATFORM_NAV) expect(ruleFor(e.to, PLATFORM_ROUTE_RULES)).toBe(e.rule);
		expect(SCHOOL_NAV.length > 15).toBe(true);
	});
});
