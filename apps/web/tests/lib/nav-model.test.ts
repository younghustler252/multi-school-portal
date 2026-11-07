import { describe, expect, it } from "vitest";
import type { MyPermissions } from "@schoolos/contracts";
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
		expect(notificationsPath("platform")).toBe("/notifications");
		expect(notificationsPath("school")).toBe("/school-admin/notifications");
	});
});
