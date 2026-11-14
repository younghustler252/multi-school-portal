/*
| THE ONE PLACE that knows where pages live (M3b).
| Pages, menus, guards, redirects and middleware all read this file, so renaming a route means editing it here
| (plus moving the folder under src/app to match) and nothing else.
|
| Naming: routes are named after the FEATURE or the area of work, never after a role. Roles are tenant data.
|   /school/*    managing the school (staff, students, classes, fees, settings...)
|   /teaching/*  the teaching workspace (my classes, attendance, grades, report cards)
|   /finance/*   the finance workspace (fees, payments)
|   /insights/*  school-wide read-only overviews
|   /family/*    a guardian's own children, fees and payments
|   /learning/*  a student's own attendance, grades and report cards
| Platform (super-admin) pages sit at the top level on the admin host, exactly as before.
|
| A page's URL must match its folder under src/app/(dashboard) or src/app/(super-admin). tests/lib/routes.test.ts
| fails if a registered page has no folder, so a rename that forgets the folder is caught.
*/

type Id = string | number | null | undefined; // pages sometimes build a link before the id is known; same behaviour as the old template strings
const join = (base: string, id: Id) => `${base}/${id}`;

export const ROUTES = {
	home: "/home",
	settings: "/settings",

	school: {
		dashboard: "/school/dashboard",
		staff: { list: "/school/staff", new: "/school/staff/new", detail: (id: Id) => join("/school/staff", id) },
		students: { list: "/school/students", new: "/school/students/new", detail: (id: Id) => join("/school/students", id) },
		guardians: { list: "/school/guardians", new: "/school/guardians/new", detail: (id: Id) => join("/school/guardians", id) },
		classes: { list: "/school/classes", detail: (id: Id) => join("/school/classes", id) },
		subjects: { list: "/school/subjects", detail: (id: Id) => join("/school/subjects", id) },
		attendance: "/school/attendance",
		grades: "/school/grades",
		reportCards: "/school/report-cards",
		fees: { list: "/school/fees", detail: (id: Id) => join("/school/fees", id) },
		payments: "/school/payments",
		notifications: "/school/notifications",
		announcements: "/school/announcements",
		settings: "/school/settings",
		promote: "/school/enrolment/promote",
	},

	teaching: {
		dashboard: "/teaching/dashboard",
		classes: "/teaching/classes",
		attendance: "/teaching/attendance",
		grades: "/teaching/grades",
		reportCards: "/teaching/report-cards",
		notifications: "/teaching/notifications",
	},

	finance: {
		dashboard: "/finance/dashboard",
		fees: "/finance/fees",
		payments: "/finance/payments",
	},

	insights: {
		overview: "/insights/overview",
		attendance: "/insights/attendance",
		grades: "/insights/grades",
	},

	family: {
		children: { list: "/family/children", detail: (id: Id) => join("/family/children", id) },
		fees: "/family/fees",
		payments: "/family/payments",
		reportCards: "/family/report-cards",
		notifications: "/family/notifications",
	},

	learning: {
		dashboard: "/learning/dashboard",
		attendance: "/learning/attendance",
		grades: "/learning/grades",
		reportCards: "/learning/report-cards",
	},

	platform: {
		dashboard: "/dashboard",
		schools: { list: "/schools", detail: (id: Id) => join("/schools", id) },
		users: "/users",
		plans: "/plans",
		subscriptions: "/subscriptions",
		feedback: "/feedback",
		notifications: "/notifications",
		settings: "/setting",
	},
} as const;

/** Where each persona lands first when nothing else says otherwise. Not a role check: persona is the API's fixed value. */
export const PERSONA_HOME = {
	STAFF: ROUTES.home,
	GUARDIAN: ROUTES.family.children.list,
	STUDENT: ROUTES.learning.grades,
} as const;

/** First path segments (as "/x") that belong to signed-in areas. Middleware and robots.txt are derived from this. */
export const SCHOOL_AREA_ROOTS = ["/school", "/teaching", "/finance", "/insights", "/family", "/learning"] as const;
export const PLATFORM_AREA_ROOTS = [
	ROUTES.platform.dashboard, ROUTES.platform.schools.list, ROUTES.platform.users, ROUTES.platform.plans,
	ROUTES.platform.subscriptions, ROUTES.platform.feedback, ROUTES.platform.notifications, ROUTES.platform.settings,
] as const;
export const PROTECTED_ROOTS: readonly string[] = [ROUTES.home, ROUTES.settings, ...SCHOOL_AREA_ROOTS, ...PLATFORM_AREA_ROOTS];

/*
| Old role-named paths and where they went. Longest prefix wins; whole path segments only; the rest of the path and
| the query string are kept. Used by middleware to send bookmarks and old emails to the new address (HTTP 308).
| Kept as data so removing a mapping later is a one-line change.
*/
export const LEGACY_PREFIXES: ReadonlyArray<readonly [from: string, to: string]> = [
	["/school-admin", "/school"],
	["/teacher/my-classes", ROUTES.teaching.classes],
	["/teacher", "/teaching"],
	["/bursar", "/finance"],
	["/principal", "/insights"],
	["/guardian/report-card", ROUTES.family.reportCards],
	["/guardian", "/family"],
	["/student", "/learning"],
];

export function legacyRedirect(pathname: string): string | null {
	let best: readonly [string, string] | null = null;
	for (const entry of LEGACY_PREFIXES) {
		const [from] = entry;
		if ((pathname === from || pathname.startsWith(`${from}/`)) && (!best || from.length > best[0].length)) best = entry;
	}
	return best ? best[1] + pathname.slice(best[0].length) : null;
}

/** Every static page the registry names (detail pages excluded). For tests and sitemaps. */
export function allStaticRoutes(): string[] {
	const out: string[] = [];
	const walk = (node: unknown) => {
		if (typeof node === "string") out.push(node);
		else if (node && typeof node === "object") Object.values(node).forEach(walk);
	};
	walk(ROUTES);
	return Array.from(new Set(out));
}
