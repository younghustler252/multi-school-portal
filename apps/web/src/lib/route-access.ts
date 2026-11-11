import type { MyPermissions } from "@schoolos/contracts";
import { PLATFORM_NAV, SCHOOL_NAV } from "@/lib/nav-model";

/*
| Which permission a page needs (M3). Pure data + one function, so it can be tested on its own.
| UX only: it decides whether to SHOW a page. The API still enforces every request.
| Role names are never consulted. The rule is "holds ANY of these permissions".
|
| Matching: the longest rule whose path is the URL or a parent segment of it wins, so
| /school-admin/staff/new (needs staff.manage) beats /school-admin/staff (needs staff.view).
| A path with no rule is allowed (the API remains the authority); it is listed in the docs as a gap, not guessed.
| Sidebar entries come from nav-model, so a page and its menu item can never disagree.
*/

export interface RouteRule {
	path: string;
	anyOf: string[];
	/** The page is "my own data": the permission must be held at OWN scope (a staff member with ALL scope has no business here). */
	own?: boolean;
}

/** Pages the menu does not list: create forms, detail pages, tools. */
const EXTRA_SCHOOL_RULES: RouteRule[] = [
	{ path: "/school-admin/dashboard", anyOf: ["school.dashboard.view"] },
	{ path: "/school-admin/staff/new", anyOf: ["staff.manage"] },
	{ path: "/school-admin/students/new", anyOf: ["students.manage"] },
	{ path: "/school-admin/guardians/new", anyOf: ["guardians.manage"] },
	{ path: "/school-admin/enrolment/promote", anyOf: ["enrolment.promote"] },
];

/*
| Guardian and student pages (permissions and scopes confirmed by the owner from the backend registry and role templates).
| Deliberately NO rule: /guardian/notifications (own inbox) and /student/dashboard (no student dashboard permission;
| school.dashboard.view is STAFF-only, so its sections follow their own permissions).
*/
const own = (path: string, key: string): RouteRule => ({ path, anyOf: [key], own: true });
const FAMILY_RULES: RouteRule[] = [
	own("/guardian/children", "students.view"),
	own("/guardian/fees", "fees.view"),
	own("/guardian/payments", "payments.pay"),
	own("/guardian/report-card", "report_cards.view"),
	own("/student/attendance", "attendance.view"),
	own("/student/grades", "grades.view"),
	own("/student/report-cards", "report_cards.view"),
];

const fromNav = (entries: { to: string; anyOf?: string[] }[]): RouteRule[] =>
	entries.filter((e) => e.anyOf && e.anyOf.length > 0).map((e) => ({ path: e.to, anyOf: e.anyOf as string[] }));

export const SCHOOL_ROUTE_RULES: RouteRule[] = [...fromNav(SCHOOL_NAV), ...EXTRA_SCHOOL_RULES, ...FAMILY_RULES];
export const PLATFORM_ROUTE_RULES: RouteRule[] = fromNav(PLATFORM_NAV);

const covers = (rulePath: string, pathname: string): boolean =>
	pathname === rulePath || pathname.startsWith(`${rulePath}/`);

export function ruleFor(pathname: string, rules: RouteRule[]): RouteRule | null {
	const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	let best: RouteRule | null = null;
	for (const r of rules) {
		if (covers(r.path, clean) && (!best || r.path.length > best.path.length)) best = r;
	}
	return best;
}

/** True when the session may see this page. No rule = allowed. No permissions loaded = not allowed. */
export function canOpenRoute(pathname: string, permissions: MyPermissions | null): boolean {
	if (!permissions) return false;
	const rules = permissions.realm === "platform" ? PLATFORM_ROUTE_RULES : SCHOOL_ROUTE_RULES;
	const rule = ruleFor(pathname, rules);
	if (!rule) return true;
	return permissions.permissions.some((p) => rule.anyOf.includes(p.key) && (!rule.own || p.scope === "OWN"));
}
