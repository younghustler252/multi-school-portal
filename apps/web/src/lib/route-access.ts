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

/** Menu sections. Entries of one section sit under one heading; "school" is management of the school itself. */
export type NavGroup = "school" | "teaching" | "finance" | "insights";
export const NAV_GROUP_LABEL: Record<NavGroup, string> = { school: "School", teaching: "Teaching", finance: "Finance", insights: "Insights" };

export interface RouteRule {
	path: string;
	/** Menu section. Omitted = no heading (Home, and the guardian/student menus). */
	group?: NavGroup;
	/**
	 * Menu only: hide this entry while the entry for `supersededBy` is shown, so one piece of work is listed once.
	 * It does not affect the guard: the page itself stays openable.
	 */
	supersededBy?: string;
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
const staffPage = (
	path: string, label: string | undefined, icon: NavIcon | undefined, anyOf: string[], minScope: Scope = "ASSIGNED",
	extra: Partial<RouteRule> = {},
): RouteRule => ({ path, label, icon, personas: STAFF, anyOf, minScope, ...extra });

const inSchool = (r: RouteRule): RouteRule => ({ ...r, group: "school" });

/*
| MENU DESIGN (no duplicate or confusing entries):
|  - Sections with headings: School, Teaching, Finance, Insights. A page is listed once.
|  - Teaching is a workspace for people whose work is scoped to ASSIGNED classes/students. It is shown only to a session
|    holding a teaching key at exactly ASSIGNED (see NAV_GROUP_VISIBLE). Principals, bursars and admins hold those keys at
|    ALL, so they do not get a Teaching section and keep the school-wide pages.
|  - While Teaching is shown, School's Attendance / Grades / Report cards are hidden (supersededBy) in favour of the
|    Teaching versions. The guard still lets the person open either URL.
|  - Finance has one entry (its overview page); Fees and Payments stay under School because the Finance routes for them
|    are the same pages. Insights are read-only school-wide overviews, distinct from the management pages.
*/

/* Menu entries and pages for managing the school (the same pages the old school-admin area had). */
const SCHOOL_MANAGEMENT: RouteRule[] = ([
	staffPage(ROUTES.school.staff.list, "Staff", "staff", ["staff.view"]),
	staffPage(ROUTES.school.students.list, "Students", "students", ["students.view"]),
	staffPage(ROUTES.school.guardians.list, "Guardians", "guardians", ["guardians.view"]),
	staffPage(ROUTES.school.classes.list, "Classes", "classes", ["classes.view"]),
	staffPage(ROUTES.school.subjects.list, "Subjects", "subjects", ["classes.view"]),
	staffPage(ROUTES.school.attendance, "Attendance", "attendance", ["attendance.view", "attendance.mark"], "ASSIGNED", { supersededBy: ROUTES.teaching.attendance }),
	staffPage(ROUTES.school.grades, "Grades", "grades", ["grades.view", "grades.enter"], "ASSIGNED", { supersededBy: ROUTES.teaching.grades }),
	staffPage(ROUTES.school.reportCards, "Report cards", "reportCards", ["report_cards.view"], "ASSIGNED", { supersededBy: ROUTES.teaching.reportCards }),
	staffPage(ROUTES.school.fees.list, "Fees", "fees", ["fees.invoices.view", "fees.setup.view"]),
	staffPage(ROUTES.school.payments, "Payments", "payments", ["payments.view"]),
	staffPage(ROUTES.school.notifications, "Notifications", "notifications", ["notifications.view"]),
	staffPage(ROUTES.school.announcements, "Announcements", "announcements", ["notifications.send"]),
	staffPage(ROUTES.school.settings, "Settings", "settings", ["school_settings.view", "school.view"]),
] as RouteRule[]).map(inSchool);

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
	staffPage(ROUTES.insights.overview, "Overview", "dashboard", ["school.dashboard.view"], "ALL", { group: "insights" }),
	staffPage(ROUTES.insights.attendance, "Attendance", "attendance", ["attendance.view"], "ALL", { group: "insights" }),
	staffPage(ROUTES.insights.grades, "Grades", "grades", ["grades.view"], "ALL", { group: "insights" }),
	staffPage(ROUTES.teaching.dashboard, "Overview", "dashboard", ["classes.view"], "ALL", { group: "teaching" }),
	staffPage(ROUTES.teaching.classes, "My classes", "classes", ["classes.view"], "ALL", { group: "teaching" }),
	staffPage(ROUTES.teaching.attendance, "Attendance", "attendance", ["attendance.view", "attendance.mark"], "ASSIGNED", { group: "teaching" }),
	staffPage(ROUTES.teaching.grades, "Grades", "grades", ["grades.view", "grades.enter"], "ASSIGNED", { group: "teaching" }),
	staffPage(ROUTES.teaching.reportCards, "Report cards", "reportCards", ["report_cards.view"], "ASSIGNED", { group: "teaching" }),
	{ path: ROUTES.teaching.notifications, personas: STAFF },
	staffPage(ROUTES.finance.dashboard, "Overview", "dashboard", ["school.dashboard.view"], "ALL", { group: "finance" }),
	// /finance/fees and /finance/payments are the same pages as /school/fees and /school/payments, so they get no menu entry
	// of their own (one place per page); the guard still covers them.
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
	family("STUDENT", ROUTES.learning.fees, "Fees", "fees", "fees.view"),
];

/** Menu order for a school session: Home, then the rules above in array order (personas never overlap). */
export const SCHOOL_ROUTE_RULES: RouteRule[] = [
	{ path: ROUTES.home, label: "Home", icon: "dashboard" },
	// Personal account page (name, phone, password): deliberately open to every signed-in school persona, so it has an
	// explicit rule instead of relying on "no rule = allowed". Reached from the account menu, not the sidebar.
	{ path: ROUTES.settings },
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

const TEACHING_KEYS = ["attendance.view", "attendance.mark", "grades.view", "grades.enter", "report_cards.view"];

/** Whether a menu section is shown at all, on top of each entry's own rule. */
export const NAV_GROUP_VISIBLE: Record<NavGroup, (p: MyPermissions) => boolean> = {
	school: () => true,
	insights: () => true,
	finance: () => true,
	teaching: (p) => p.permissions.some((x) => TEACHING_KEYS.includes(x.key) && x.scope === "ASSIGNED"),
};

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
