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
