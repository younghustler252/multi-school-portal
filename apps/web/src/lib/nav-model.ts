import type { MyPermissions } from "@schoolos/contracts";

/*
| Navigation as data: which entry is shown to whom (AUTHZ-003). Pure and icon-free so it can be tested on its own.
| An entry appears when the session holds at least one of its permissions. Role names are never consulted:
| they are tenant data, permissions are the contract. Hiding an entry is a convenience; the API still enforces access.
*/

export type NavIcon =
	| "dashboard" | "staff" | "students" | "guardians" | "classes" | "subjects" | "attendance" | "grades"
	| "reportCards" | "fees" | "payments" | "notifications" | "announcements" | "settings"
	| "schools" | "users" | "plans" | "subscriptions" | "feedback";

export interface NavEntry {
	label: string;
	to: string;
	icon: NavIcon;
	/** Shown when the session holds ANY of these. Omit = always shown. */
	anyOf?: string[];
}

export const SCHOOL_NAV: NavEntry[] = [
	{ label: "Home", to: "/home", icon: "dashboard" },
	{ label: "Staff", to: "/school-admin/staff", icon: "staff", anyOf: ["staff.view"] },
	{ label: "Students", to: "/school-admin/students", icon: "students", anyOf: ["students.view"] },
	{ label: "Guardians", to: "/school-admin/guardians", icon: "guardians", anyOf: ["guardians.view"] },
	{ label: "Classes", to: "/school-admin/classes", icon: "classes", anyOf: ["classes.view"] },
	{ label: "Subjects", to: "/school-admin/subjects", icon: "subjects", anyOf: ["classes.view"] },
	{ label: "Attendance", to: "/school-admin/attendance", icon: "attendance", anyOf: ["attendance.view", "attendance.mark"] },
	{ label: "Grades", to: "/school-admin/grades", icon: "grades", anyOf: ["grades.view", "grades.enter"] },
	{ label: "Report cards", to: "/school-admin/report-cards", icon: "reportCards", anyOf: ["report_cards.view"] },
	{ label: "Fees", to: "/school-admin/fees", icon: "fees", anyOf: ["fees.invoices.view", "fees.setup.view"] },
	{ label: "Payments", to: "/school-admin/payments", icon: "payments", anyOf: ["payments.view"] },
	{ label: "Notifications", to: "/school-admin/notifications", icon: "notifications", anyOf: ["notifications.view"] },
	{ label: "Announcements", to: "/school-admin/announcement", icon: "announcements", anyOf: ["notifications.send"] },
	{ label: "Settings", to: "/school-admin/settings", icon: "settings", anyOf: ["school_settings.view", "school.view"] },
];

export const PLATFORM_NAV: NavEntry[] = [
	{ label: "Dashboard", to: "/dashboard", icon: "dashboard", anyOf: ["platform.overview.view"] },
	{ label: "Schools", to: "/schools", icon: "schools", anyOf: ["platform.schools.view"] },
	{ label: "Users", to: "/users", icon: "users", anyOf: ["platform.users.manage"] },
	{ label: "Plans", to: "/plans", icon: "plans", anyOf: ["platform.plans.view"] },
	{ label: "Subscriptions", to: "/subscriptions", icon: "subscriptions", anyOf: ["platform.subscriptions.view"] },
	{ label: "Feedback", to: "/feedback", icon: "feedback", anyOf: ["platform.feedback.manage"] },
	{ label: "Notifications", to: "/notifications", icon: "notifications", anyOf: ["platform.notifications.view"] },
	{ label: "Settings", to: "/setting", icon: "settings", anyOf: ["platform.settings.manage"] },
];

export function visibleNav(permissions: MyPermissions | null): NavEntry[] {
	if (!permissions) return [];
	const held = new Set(permissions.permissions.map((p) => p.key));
	const source = permissions.realm === "platform" ? PLATFORM_NAV : SCHOOL_NAV;
	return source.filter((e) => !e.anyOf || e.anyOf.some((k) => held.has(k)));
}

/** Where the bell's "see all" link goes. */
export function notificationsPath(realm: "school" | "platform"): string {
	return realm === "platform" ? "/notifications" : "/school-admin/notifications";
}
