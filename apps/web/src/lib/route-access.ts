import type { MyPermissions, PersonaType, Scope } from "@schoolos/contracts";
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
	/**
	 * Staff pages: the permission must be held at this scope OR BROADER (ALL > BRANCH > ASSIGNED > OWN).
	 * Omitted = any scope. Example: a teacher page asks for ASSIGNED, so ALL also opens it, OWN does not.
	 */
	minScope?: Scope;
	/**
	 * Self-service pages ("my children", "my grades"): the API-provided persona must match AND the permission must be
	 * held at exactly OWN. See the note above FAMILY_RULES for why both, and why ALL does not qualify.
	 */
	selfService?: PersonaType;
}

const RANK: Record<Scope, number> = { OWN: 0, ASSIGNED: 1, BRANCH: 2, ALL: 3 };

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
|
| Why persona AND exactly-OWN scope (both UX only, the API still enforces):
|  - These pages are "my own data". Persona is what the API says this session IS (GUARDIAN or STUDENT). It is not a role
|    name: roles are tenant data, persona is a fixed contract value. A guardian session should not see student pages
|    and the reverse, even though both hold keys such as report_cards.view at OWN.
|  - Exactly OWN, not "OWN or broader": a staff member holding students.view at ALL sees every student elsewhere in the
|    portal. These pages call the "my children / my grades" endpoints, which would be empty or wrong for them, so
|    showing the page would only confuse. If a custom role ever needs them, that is a backend decision, not a guard tweak.
|
| Deliberately NO rule: /guardian/notifications (own inbox) and /student/dashboard (no student dashboard permission;
| school.dashboard.view is STAFF-only, so its sections follow their own permissions).
*/
const family = (persona: PersonaType, path: string, key: string): RouteRule => ({ path, anyOf: [key], selfService: persona });
const FAMILY_RULES: RouteRule[] = [
	family("GUARDIAN", "/guardian/children", "students.view"),
	family("GUARDIAN", "/guardian/fees", "fees.view"),
	family("GUARDIAN", "/guardian/payments", "payments.pay"),
	family("GUARDIAN", "/guardian/report-card", "report_cards.view"),
	family("STUDENT", "/student/attendance", "attendance.view"),
	family("STUDENT", "/student/grades", "grades.view"),
	family("STUDENT", "/student/report-cards", "report_cards.view"),
];

/*
| Principal, teacher and bursar pages (owner-confirmed from the backend ROLE_TEMPLATES, 2026-11-11).
| These guard VIEWING the page. Actions inside a page (mark, enter, issue, record...) keep their own permission checks
| in the page, so a view permission here never implies an action permission.
| Scopes are minimums: a teacher page asks for ASSIGNED, so a broader scope (ALL) also qualifies; OWN does not.
| Deliberately NO rule: /teacher/notifications (own inbox).
*/
const staff = (path: string, anyOf: string[], minScope: Scope): RouteRule => ({ path, anyOf, minScope });
const STAFF_AREA_RULES: RouteRule[] = [
	staff("/principal/overview", ["school.dashboard.view"], "ALL"),
	staff("/principal/attendance", ["attendance.view"], "ALL"),
	staff("/principal/grades", ["grades.view"], "ALL"),
	staff("/teacher/dashboard", ["classes.view"], "ALL"),
	staff("/teacher/attendance", ["attendance.view", "attendance.mark"], "ASSIGNED"),
	staff("/teacher/grades", ["grades.view", "grades.enter"], "ASSIGNED"),
	staff("/teacher/my-classes", ["classes.view"], "ALL"),
	staff("/teacher/report-cards", ["report_cards.view"], "ASSIGNED"),
	staff("/bursar/dashboard", ["school.dashboard.view"], "ALL"),
	staff("/bursar/fees", ["fees.invoices.view", "fees.setup.view"], "ALL"),
	staff("/bursar/payments", ["payments.view"], "ALL"),
];

const fromNav = (entries: { to: string; anyOf?: string[] }[]): RouteRule[] =>
	entries.filter((e) => e.anyOf && e.anyOf.length > 0).map((e) => ({ path: e.to, anyOf: e.anyOf as string[] }));

export const SCHOOL_ROUTE_RULES: RouteRule[] = [...fromNav(SCHOOL_NAV), ...EXTRA_SCHOOL_RULES, ...FAMILY_RULES, ...STAFF_AREA_RULES];
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
	if (rule.selfService && permissions.persona !== rule.selfService) return false;
	return permissions.permissions.some((p) => {
		if (!rule.anyOf.includes(p.key)) return false;
		if (rule.selfService) return p.scope === "OWN";
		return !rule.minScope || RANK[p.scope] >= RANK[rule.minScope];
	});
}
