import { describe, expect, it } from "vitest";
import type { MyPermissions } from "@schoolos/contracts";
import { ROUTES } from "@/lib/routes";
import { canOpenRoute } from "@/lib/route-access";
import { notificationsPath, PLATFORM_NAV, SCHOOL_NAV, visibleNav } from "@/lib/nav-model";

function me(keys: string[], realm: "school" | "platform" = "school"): MyPermissions {
	return {
		realm, persona: realm === "school" ? "STAFF" : null, roles: [], holdsEverything: false,
		permissions: keys.map((key) => ({ key, scope: "ALL" as const })),
		branches: { all: [], assigned: [], schoolHasSeveral: false },
	};
}
const labels = (p: MyPermissions | null) => visibleNav(p).map((e) => e.label);

describe("visibleNav", () => {
	it("shows nothing before permissions are loaded", () => {
		expect(visibleNav(null)).toEqual([]);
	});

	it("a school session with no permissions still gets Home, and nothing else", () => {
		expect(labels(me([]))).toEqual(["Home"]);
	});

	it("shows an entry when ANY of its permissions is held", () => {
		expect(labels(me(["students.view"]))).toEqual(["Home", "Students"]);
		expect(labels(me(["attendance.mark"]))).toEqual(["Home", "Attendance"]);
	});

	it("depends on permissions only: nothing about role names changes the menu", () => {
		const a = { ...me(["staff.view"]), roles: ["school_admin"] };
		const b = { ...me(["staff.view"]), roles: ["something a school invented"] };
		expect(labels(a)).toEqual(labels(b));
	});

	it("a platform session gets platform entries, never school ones", () => {
		const out = labels(me(["platform.schools.view", "students.view"], "platform"));
		expect(out).toEqual(["Schools"]);
	});

	it("keeps registry order", () => {
		expect(labels(me(["payments.view", "staff.view"]))).toEqual(["Home", "Staff", "Payments"]);
	});

	it("never mixes realms in the tables: platform keys only in PLATFORM_NAV, none in SCHOOL_NAV", () => {
		for (const e of SCHOOL_NAV) for (const k of e.anyOf ?? []) expect(k.startsWith("platform.")).toBe(false);
		for (const e of PLATFORM_NAV) for (const k of e.anyOf ?? []) expect(k.startsWith("platform.")).toBe(true);
	});

	it("points the notification bell at the right inbox", () => {
		expect(notificationsPath("platform")).toBe(ROUTES.platform.notifications);
		expect(notificationsPath("school")).toBe(ROUTES.school.notifications);
	});
});

describe("persona and scope in the menu (same rules as the route guard)", () => {
	type Persona = "STAFF" | "GUARDIAN" | "STUDENT";
	const as = (persona: Persona, entries: [string, "ALL" | "BRANCH" | "ASSIGNED" | "OWN"][]): MyPermissions => ({
		...me([]), persona, permissions: entries.map(([key, scope]) => ({ key, scope })),
	});
	const guardian = as("GUARDIAN", [["students.view", "OWN"], ["attendance.view", "OWN"], ["grades.view", "OWN"], ["report_cards.view", "OWN"], ["fees.view", "OWN"], ["payments.pay", "OWN"]]);
	const student = as("STUDENT", [["students.view", "OWN"], ["attendance.view", "OWN"], ["grades.view", "OWN"], ["report_cards.view", "OWN"], ["fees.view", "OWN"]]);
	const teacher = as("STAFF", [["students.view", "ASSIGNED"], ["attendance.mark", "ASSIGNED"], ["classes.view", "ALL"]]);

	it("a guardian or student never sees a school-management entry, even holding students.view and friends at OWN", () => {
		for (const who of [guardian, student]) {
			expect(visibleNav(who).filter((e) => e.to.startsWith("/school/"))).toEqual([]);
			for (const e of SCHOOL_NAV.filter((n) => n.to.startsWith("/school/"))) expect(canOpenRoute(e.to, who)).toBe(false);
		}
	});

	it("a guardian gets their own menu", () => {
		expect(labels(guardian)).toEqual(["Home", "My children", "Fees", "Payments", "Report cards", "Notifications"]);
	});

	it("a student gets their own menu, with no payments entry", () => {
		expect(labels(student)).toEqual(["Home", "Dashboard", "Attendance", "Grades", "Report cards"]);
	});

	it("staff holding keys at ASSIGNED or ALL get management entries, and no family entries", () => {
		expect(labels(teacher)).toEqual(["Home", "Students", "Classes", "Subjects", "Attendance"]);
		expect(visibleNav(teacher).some((e) => e.to.startsWith("/family") || e.to.startsWith("/learning"))).toBe(false);
	});

	it("a STAFF session holding a key only at OWN does not get the entry (scope floor)", () => {
		expect(labels(as("STAFF", [["students.view", "OWN"]]))).toEqual(["Home"]);
	});

	it("the menu and the guard always agree", () => {
		for (const who of [guardian, student, teacher, me(["staff.view", "students.view"]), me([])]) {
			for (const e of SCHOOL_NAV) {
				const shown = visibleNav(who).some((v) => v.to === e.to);
				expect(canOpenRoute(e.to, who), `${e.to}`).toBe(shown);
			}
		}
	});

	it("the bell links to an inbox the session may open", () => {
		expect(notificationsPath("school", "STAFF")).toBe(ROUTES.school.notifications);
		expect(notificationsPath("school", "GUARDIAN")).toBe(ROUTES.family.notifications);
		expect(canOpenRoute(notificationsPath("school", "GUARDIAN"), guardian)).toBe(true);
		expect(notificationsPath("school", "STUDENT")).toBe(ROUTES.home);
	});
});
