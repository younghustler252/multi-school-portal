import type { MyPermissions, PersonaType, Scope } from "@schoolos/contracts";
import { ROUTES } from "@/lib/routes";

/*
| WHO MAY OPEN WHICH PAGE, and which pages appear in the menu. One table, three readers:
|   - route guards (components/layout/route-access-guard.tsx)  -> canOpenRoute()
|   - the sidebar and the /home page                           -> visibleNav() in nav-model.ts, built from the same rules
|   - tests that check the two never disagree
| So a page and its menu entry cannot drift apart: an entry is shown exactly when the guard would let the person in.
|
| UX only: it decides what to SHOW. The API still enforces every request. Role names are never consulted.
|
| A rule can ask for, all together:
|   personas  the API-provided persona (STAFF, GUARDIAN, STUDENT). A fixed contract value, not a role name.
|   anyOf     ANY of these permission keys (omitted/empty = no permission needed)
|   minScope  held at this scope or broader (ALL > BRANCH > ASSIGNED > OWN)
|   ownOnly   held at exactly OWN ("my own data" pages)
|
| Matching: the longest rule whose path is the URL or a parent segment of it wins, so
| /school/staff/new (needs staff.manage) beats /school/staff (needs staff.view).
| A path with no rule is allowed (the API remains the authority); the docs list those, they are not guessed.
*/

export type NavIcon =
	| "dashboard" | "staff" | "students" | "guardians" | "classes" | "subjects" | "attendance" | "grades"
	| "reportCards" | "fees" | "payments" | "notifications" | "announcements" | "settings"
	| "schools" | "users" | "plans" | "subscriptions" | "feedback";

export interface RouteRule {
	path: string;
	/** Present = the page appears in the menu (and on /home) for sessions that may open it. Array order is menu order. */
	label?: string;
	icon?: NavIcon;
	personas?: PersonaType[];
	anyOf?: string[];
	minScope?: Scope;
	ownOnly?: boolean;
}

const RANK: Record<Scope, number> = { OWN: 0, ASSIGNED: 1, BRANCH: 2, ALL: 3 };

const STAFF: PersonaType[] = ["STAFF"];

/*
| Staff pages need the STAFF persona AND the permission at ASSIGNED scope or broader.
| Why both: students and guardians hold keys such as students.view, attendance.view, grades.view and report_cards.view
| at OWN, so a key alone would show them staff pages. Persona says who the session is; the scope floor is a second layer
| that keeps an OWN-only grant out even if a custom role ever mixes things.
*/
const staffPage = (path: string, label: string | undefined, icon: NavIcon | undefined, anyOf: string[], minScope: Scope = "ASSIGNED"): RouteRule => ({
	path, label, icon, personas: STAFF, anyOf, minScope,
});

/* Menu entries and pages for managing the school (the same pages the old school-admin area had). */
const SCHOOL_MANAGEMENT: RouteRule[] = [
	staffPage(ROUTES.school.staff.list, "Staff", "staff", ["staff.view"]),
	staffPage(ROUTES.school.students.list, "Students", "students", ["students.view"]),
	staffPage(ROUTES.school.guardians.list, "Guardians", "guardians", ["guardians.view"]),
	staffPage(ROUTES.school.classes.list, "Classes", "classes", ["classes.view"]),
	staffPage(ROUTES.school.subjects.list, "Subjects", "subjects", ["classes.view"]),
	staffPage(ROUTES.school.attendance, "Attendance", "attendance", ["attendance.view", "attendance.mark"]),
	staffPage(ROUTES.school.grades, "Grades", "grades", ["grades.view", "grades.enter"]),
	staffPage(ROUTES.school.reportCards, "Report cards", "reportCards", ["report_cards.view"]),
	staffPage(ROUTES.school.fees.list, "Fees", "fees", ["fees.invoices.view", "fees.setup.view"]),
	staffPage(ROUTES.school.payments, "Payments", "payments", ["payments.view"]),
	staffPage(ROUTES.school.notifications, "Notifications", "notifications", ["notifications.view"]),
	staffPage(ROUTES.school.announcements, "Announcements", "announcements", ["notifications.send"]),
	staffPage(ROUTES.school.settings, "Settings", "settings", ["school_settings.view", "school.view"]),
];

/* Pages the menu does not list: dashboard, create forms, tools. */
const SCHOOL_EXTRA: RouteRule[] = [
	staffPage(ROUTES.school.dashboard, undefined, undefined, ["school.dashboard.view"]),
	staffPage(ROUTES.school.staff.new, undefined, undefined, ["staff.manage"]),
	staffPage(ROUTES.school.students.new, undefined, undefined, ["students.manage"]),
	staffPage(ROUTES.school.guardians.new, undefined, undefined, ["guardians.manage"]),
	staffPage(ROUTES.school.promote, undefined, undefined, ["enrolment.promote"]),
];

/*
| Principal, teacher and bursar pages (owner-confirmed from the backend ROLE_TEMPLATES, 2026-11-11).
| These guard VIEWING a page. Actions inside a page (mark, enter, issue, record...) keep their own permission checks,
| so a view permission here never implies an action permission. Scope is a minimum.
| No menu entry yet (they were never in the permission-based menu); no rule for the teaching notifications inbox
| beyond the STAFF persona.
*/
const STAFF_AREAS: RouteRule[] = [
	staffPage(ROUTES.insights.overview, undefined, undefined, ["school.dashboard.view"], "ALL"),
	staffPage(ROUTES.insights.attendance, undefined, undefined, ["attendance.view"], "ALL"),
	staffPage(ROUTES.insights.grades, undefined, undefined, ["grades.view"], "ALL"),
	staffPage(ROUTES.teaching.dashboard, undefined, undefined, ["classes.view"], "ALL"),
	staffPage(ROUTES.teaching.attendance, undefined, undefined, ["attendance.view", "attendance.mark"], "ASSIGNED"),
	staffPage(ROUTES.teaching.grades, undefined, undefined, ["grades.view", "grades.enter"], "ASSIGNED"),
	staffPage(ROUTES.teaching.classes, undefined, undefined, ["classes.view"], "ALL"),
	staffPage(ROUTES.teaching.reportCards, undefined, undefined, ["report_cards.view"], "ASSIGNED"),
	{ path: ROUTES.teaching.notifications, personas: STAFF },
	staffPage(ROUTES.finance.dashboard, undefined, undefined, ["school.dashboard.view"], "ALL"),
	staffPage(ROUTES.finance.fees, undefined, undefined, ["fees.invoices.view", "fees.setup.view"], "ALL"),
	staffPage(ROUTES.finance.payments, undefined, undefined, ["payments.view"], "ALL"),
];

/*
| Guardian and student pages (permissions and scopes confirmed by the owner from the backend registry and role templates).
|
| Why persona AND exactly-OWN scope (both UX only, the API still enforces):
|  - These pages are "my own data". Persona is what the API says this session IS. A guardian session should not see
|    student pages and the reverse, even though both hold keys such as report_cards.view at OWN.
|  - Exactly OWN, not "OWN or broader": a staff member holding students.view at ALL sees every student elsewhere in the
|    portal. These pages call the "my children / my grades" endpoints, which would be empty or wrong for them. If a custom
|    role ever needs them, that is a backend decision, not a guard tweak.
|
| The guardian notifications inbox and the learning dashboard need no permission (own inbox; no student dashboard
| permission exists and school.dashboard.view is STAFF-only), so they are persona-only.
*/
const family = (persona: PersonaType, path: string, label: string, icon: NavIcon, key: string): RouteRule => ({
	path, label, icon, personas: [persona], anyOf: [key], ownOnly: true,
});

const FAMILY: RouteRule[] = [
	family("GUARDIAN", ROUTES.family.children.list, "My children", "students", "students.view"),
	family("GUARDIAN", ROUTES.family.fees, "Fees", "fees", "fees.view"),
	family("GUARDIAN", ROUTES.family.payments, "Payments", "payments", "payments.pay"),
	family("GUARDIAN", ROUTES.family.reportCards, "Report cards", "reportCards", "report_cards.view"),
	{ path: ROUTES.family.notifications, label: "Notifications", icon: "notifications", personas: ["GUARDIAN"] },
];

const LEARNING: RouteRule[] = [
	{ path: ROUTES.learning.dashboard, label: "Dashboard", icon: "dashboard", personas: ["STUDENT"] },
	family("STUDENT", ROUTES.learning.attendance, "Attendance", "attendance", "attendance.view"),
	family("STUDENT", ROUTES.learning.grades, "Grades", "grades", "grades.view"),
	family("STUDENT", ROUTES.learning.reportCards, "Report cards", "reportCards", "report_cards.view"),
];

/** Menu order for a school session: Home, then the rules above in array order (personas never overlap). */
export const SCHOOL_ROUTE_RULES: RouteRule[] = [
	{ path: ROUTES.home, label: "Home", icon: "dashboard" },
	...SCHOOL_MANAGEMENT, ...SCHOOL_EXTRA, ...STAFF_AREAS, ...FAMILY, ...LEARNING,
];

export const PLATFORM_ROUTE_RULES: RouteRule[] = [
	{ path: ROUTES.platform.dashboard, label: "Dashboard", icon: "dashboard", anyOf: ["platform.overview.view"] },
	{ path: ROUTES.platform.schools.list, label: "Schools", icon: "schools", anyOf: ["platform.schools.view"] },
	{ path: ROUTES.platform.users, label: "Users", icon: "users", anyOf: ["platform.users.manage"] },
	{ path: ROUTES.platform.plans, label: "Plans", icon: "plans", anyOf: ["platform.plans.view"] },
	{ path: ROUTES.platform.subscriptions, label: "Subscriptions", icon: "subscriptions", anyOf: ["platform.subscriptions.view"] },
	{ path: ROUTES.platform.feedback, label: "Feedback", icon: "feedback", anyOf: ["platform.feedback.manage"] },
	{ path: ROUTES.platform.notifications, label: "Notifications", icon: "notifications", anyOf: ["platform.notifications.view"] },
	{ path: ROUTES.platform.settings, label: "Settings", icon: "settings", anyOf: ["platform.settings.manage"] },
];

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

export function rulesFor(permissions: MyPermissions): RouteRule[] {
	return permissions.realm === "platform" ? PLATFORM_ROUTE_RULES : SCHOOL_ROUTE_RULES;
}

/** Does this session satisfy this rule? The single decision used by guards and menus. */
export function satisfies(rule: RouteRule, permissions: MyPermissions): boolean {
	if (rule.personas && (permissions.persona === null || !rule.personas.includes(permissions.persona))) return false;
	if (!rule.anyOf || rule.anyOf.length === 0) return true;
	return permissions.permissions.some((p) => {
		if (!rule.anyOf!.includes(p.key)) return false;
		if (rule.ownOnly) return p.scope === "OWN";
		return !rule.minScope || RANK[p.scope] >= RANK[rule.minScope];
	});
}

/** True when the session may see this page. No rule = allowed. No permissions loaded = not allowed. */
export function canOpenRoute(pathname: string, permissions: MyPermissions | null): boolean {
	if (!permissions) return false;
	const rule = ruleFor(pathname, rulesFor(permissions));
	return rule ? satisfies(rule, permissions) : true;
}
