import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { allStaticRoutes, legacyRedirect, LEGACY_PREFIXES, PERSONA_HOME, PROTECTED_ROOTS, ROUTES } from "@/lib/routes";
import { decideRoute } from "@/lib/route-guard";

const appDir = fileURLToPath(new URL("../../src/app", import.meta.url));
const none = { hasAccessCookie: false, hasRefreshCookie: false };

/** Static page URLs that exist as folders (route groups removed). Dynamic [id] folders are skipped. */
function pagesOnDisk(): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) walk(full);
			else if (name === "page.tsx") {
				const url = "/" + relative(appDir, dir).split(/[\\/]/).filter((seg) => !/^\(.*\)$/.test(seg)).join("/");
				if (!url.includes("[")) out.push(url === "/" ? "/" : url);
			}
		}
	};
	for (const group of ["(dashboard)", "(super-admin)"]) walk(join(appDir, group));
	return out;
}

describe("route registry", () => {
	it("every registered page has a folder", () => {
		for (const url of allStaticRoutes()) {
			const hasGroup = ["(dashboard)", "(super-admin)"].some((g) => existsSync(join(appDir, g, ...url.split("/").filter(Boolean), "page.tsx")));
			expect(hasGroup, `no page folder for ${url}`).toBe(true);
		}
	});

	it("every page folder is registered (no orphan pages)", () => {
		const registered = new Set(allStaticRoutes());
		for (const url of pagesOnDisk()) expect(registered.has(url), `${url} is not in ROUTES`).toBe(true);
	});

	it("detail builders", () => {
		expect(ROUTES.school.staff.detail("abc")).toBe("/school/staff/abc");
		expect(ROUTES.family.children.detail(7)).toBe("/family/children/7");
		expect(ROUTES.platform.schools.detail("x")).toBe("/schools/x");
	});

	it("routes are named after features, never roles", () => {
		const roleNames = ["school-admin", "teacher", "bursar", "principal", "guardian", "student"];
		for (const url of allStaticRoutes()) {
			for (const seg of url.split("/")) expect(roleNames.includes(seg), `${url} has role-named segment ${seg}`).toBe(false);
		}
	});

	it("persona homes are real pages", () => {
		expect(Object.values(PERSONA_HOME).every((p) => allStaticRoutes().includes(p))).toBe(true);
	});
});

describe("legacy redirects", () => {
	it("moves old role-named paths to the feature routes", () => {
		expect(legacyRedirect("/school-admin/staff")).toBe("/school/staff");
		expect(legacyRedirect("/school-admin/staff/abc")).toBe("/school/staff/abc");
		expect(legacyRedirect("/school-admin/enrolment/promote")).toBe(ROUTES.school.promote);
		expect(legacyRedirect("/teacher/my-classes")).toBe(ROUTES.teaching.classes);
		expect(legacyRedirect("/teacher/attendance")).toBe(ROUTES.teaching.attendance);
		expect(legacyRedirect("/bursar/fees")).toBe(ROUTES.finance.fees);
		expect(legacyRedirect("/principal/overview")).toBe(ROUTES.insights.overview);
		expect(legacyRedirect("/guardian/report-card")).toBe(ROUTES.family.reportCards);
		expect(legacyRedirect("/guardian/children/9")).toBe("/family/children/9");
		expect(legacyRedirect("/student/grades")).toBe(ROUTES.learning.grades);
	});

	it("uses whole segments and ignores new or unrelated paths", () => {
		expect(legacyRedirect("/school-administration")).toBeNull();
		expect(legacyRedirect("/students")).toBeNull();
		expect(legacyRedirect("/school/staff")).toBeNull();
		expect(legacyRedirect("/home")).toBeNull();
	});

	it("every old page that existed lands on a real page", () => {
		const oldPages = [
			"/school-admin/dashboard", "/school-admin/attendance", "/school-admin/grades", "/school-admin/report-cards", "/school-admin/fees",
			"/school-admin/payments", "/school-admin/notifications", "/school-admin/announcements", "/school-admin/settings", "/school-admin/classes",
			"/school-admin/subjects", "/school-admin/staff", "/school-admin/students", "/school-admin/guardians", "/school-admin/enrolment/promote",
			"/teacher/dashboard", "/teacher/attendance", "/teacher/grades", "/teacher/my-classes", "/teacher/notifications", "/teacher/report-cards",
			"/bursar/dashboard", "/bursar/fees", "/bursar/payments", "/principal/overview", "/principal/attendance", "/principal/grades",
			"/guardian/children", "/guardian/fees", "/guardian/payments", "/guardian/report-card", "/guardian/notifications",
			"/student/dashboard", "/student/attendance", "/student/grades", "/student/report-cards",
		];
		const known = new Set(allStaticRoutes());
		for (const old of oldPages) expect(known.has(legacyRedirect(old) as string), `${old} -> ${legacyRedirect(old)}`).toBe(true);
	});

	it("each legacy prefix is listed once", () => {
		const froms = LEGACY_PREFIXES.map(([f]) => f);
		expect(new Set(froms).size).toBe(froms.length);
	});
});

describe("middleware protection derives from the registry", () => {
	it("every signed-in area needs a session cookie", () => {
		for (const root of PROTECTED_ROOTS) {
			expect(decideRoute({ pathname: root, ...none }).action, root).toBe("login");
		}
		expect(decideRoute({ pathname: "/school/staff/abc", ...none }).action).toBe("login");
		expect(decideRoute({ pathname: "/", ...none }).action).toBe("next");
		expect(decideRoute({ pathname: "/pricing", ...none }).action).toBe("next");
	});
});
