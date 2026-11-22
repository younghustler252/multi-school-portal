import { describe, expect, it } from "vitest";
import type { MyPermissions } from "@schoolos/contracts";
import { ROUTES } from "@/lib/routes";
import { canOpenRoute, NAV_GROUP_VISIBLE, ruleFor, SCHOOL_ROUTE_RULES } from "@/lib/route-access";
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
		for (const e of SCHOOL_NAV) for (const k of e.rule.anyOf ?? []) expect(k.startsWith("platform.")).toBe(false);
		for (const e of PLATFORM_NAV) for (const k of e.rule.anyOf ?? []) expect(k.startsWith("platform.")).toBe(true);
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

	it("a student gets their own menu (fees, but no payments entry)", () => {
		expect(labels(student)).toEqual(["Home", "Dashboard", "Attendance", "Grades", "Report cards", "Fees"]);
	});

	it("staff holding keys at ASSIGNED or ALL get management entries, and no family entries", () => {
		expect(labels(teacher)).toEqual(["Home", "Students", "Classes", "Subjects", "Overview", "My classes", "Attendance"]);
		expect(visibleNav(teacher).some((e) => e.to.startsWith("/family") || e.to.startsWith("/learning"))).toBe(false);
	});

	it("a STAFF session holding a key only at OWN does not get the entry (scope floor)", () => {
		expect(labels(as("STAFF", [["students.view", "OWN"]]))).toEqual(["Home"]);
	});

	it("every entry the menu shows is a page the guard lets the person open", () => {
		for (const who of [guardian, student, teacher, me(["staff.view", "students.view"]), me([])]) {
			for (const e of visibleNav(who)) expect(canOpenRoute(e.to, who), `${e.to}`).toBe(true);
		}
	});

	it("an entry is hidden from the menu only for a stated reason: the guard denies, its section is off, or it is superseded", () => {
		for (const who of [guardian, student, teacher, me(["staff.view", "students.view"]), me([])]) {
			const shown = new Set(visibleNav(who).map((v) => v.to));
			for (const e of SCHOOL_NAV) {
				if (shown.has(e.to)) continue;
				const denied = !canOpenRoute(e.to, who);
				const sectionOff = e.rule.group === "teaching" && !NAV_GROUP_VISIBLE.teaching(who);
				const superseded = !!e.rule.supersededBy && shown.has(e.rule.supersededBy);
				expect(denied || sectionOff || superseded, `${e.to} hidden without a reason`).toBe(true);
			}
		}
	});

	it("the bell links to an inbox the session may open", () => {
		expect(notificationsPath("school", "STAFF")).toBe(ROUTES.school.notifications);
		expect(notificationsPath("school", "GUARDIAN")).toBe(ROUTES.family.notifications);
		expect(canOpenRoute(ROUTES.family.notifications, guardian)).toBe(true);
		expect(notificationsPath("school", "STUDENT")).toBeNull(); // no inbox page: the bell says so
		expect(notificationsPath("platform")).toBe(ROUTES.platform.notifications);
	});

	it("teaching: a teacher gets a Teaching section and School drops the duplicate work pages", () => {
		const groups = visibleNav(teacher).map((e) => e.groupLabel);
		expect(groups.includes("Teaching")).toBe(true);
		const paths = visibleNav(teacher).map((e) => e.to);
		expect(paths.includes(ROUTES.school.attendance)).toBe(false); // replaced by /teaching/attendance
		expect(paths.includes(ROUTES.teaching.attendance)).toBe(true);
	});

	it("principal, bursar and admin hold the same keys at ALL, so no Teaching section and no duplicates", () => {
		const principal = as("STAFF", [["school.dashboard.view", "ALL"], ["attendance.view", "ALL"], ["grades.view", "ALL"], ["classes.view", "ALL"], ["students.view", "ALL"], ["fees.invoices.view", "ALL"], ["payments.view", "ALL"]]);
		const bursar = as("STAFF", [["school.dashboard.view", "ALL"], ["fees.invoices.view", "ALL"], ["payments.view", "ALL"], ["classes.view", "ALL"], ["students.view", "ALL"]]);
		for (const who of [principal, bursar]) {
			const entries = visibleNav(who);
			expect(entries.some((e) => e.group === "teaching")).toBe(false);
			const seen = new Set<string>();
			for (const e of entries) {
				const k = `${e.group}:${e.label}`;
				expect(seen.has(k), `duplicate ${k}`).toBe(false);
				seen.add(k);
			}
		}
		expect(visibleNav(principal).filter((e) => e.group === "insights").map((e) => e.label)).toEqual(["Overview", "Attendance", "Grades"]);
		expect(visibleNav(bursar).some((e) => e.to === ROUTES.finance.dashboard)).toBe(true);
		expect(visibleNav(bursar).some((e) => e.to === ROUTES.insights.overview)).toBe(true); // same key; unique page, so not a duplicate
	});

	it("account settings has an explicit rule and is open to every persona", () => {
		expect(ruleFor(ROUTES.settings, SCHOOL_ROUTE_RULES)?.path).toBe(ROUTES.settings);
		for (const who of [guardian, student, teacher, as("STAFF", [])]) expect(canOpenRoute(ROUTES.settings, who)).toBe(true);
	});
});
