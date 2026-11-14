import type { MyPermissions } from "@schoolos/contracts";
import { ROUTES } from "@/lib/routes";

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
	{ label: "Home", to: ROUTES.home, icon: "dashboard" },
	{ label: "Staff", to: ROUTES.school.staff.list, icon: "staff", anyOf: ["staff.view"] },
	{ label: "Students", to: ROUTES.school.students.list, icon: "students", anyOf: ["students.view"] },
	{ label: "Guardians", to: ROUTES.school.guardians.list, icon: "guardians", anyOf: ["guardians.view"] },
	{ label: "Classes", to: ROUTES.school.classes.list, icon: "classes", anyOf: ["classes.view"] },
	{ label: "Subjects", to: ROUTES.school.subjects.list, icon: "subjects", anyOf: ["classes.view"] },
	{ label: "Attendance", to: ROUTES.school.attendance, icon: "attendance", anyOf: ["attendance.view", "attendance.mark"] },
	{ label: "Grades", to: ROUTES.school.grades, icon: "grades", anyOf: ["grades.view", "grades.enter"] },
	{ label: "Report cards", to: ROUTES.school.reportCards, icon: "reportCards", anyOf: ["report_cards.view"] },
	{ label: "Fees", to: ROUTES.school.fees.list, icon: "fees", anyOf: ["fees.invoices.view", "fees.setup.view"] },
	{ label: "Payments", to: ROUTES.school.payments, icon: "payments", anyOf: ["payments.view"] },
	{ label: "Notifications", to: ROUTES.school.notifications, icon: "notifications", anyOf: ["notifications.view"] },
	{ label: "Announcements", to: ROUTES.school.announcements, icon: "announcements", anyOf: ["notifications.send"] },
	{ label: "Settings", to: ROUTES.school.settings, icon: "settings", anyOf: ["school_settings.view", "school.view"] },
];

export const PLATFORM_NAV: NavEntry[] = [
	{ label: "Dashboard", to: ROUTES.platform.dashboard, icon: "dashboard", anyOf: ["platform.overview.view"] },
	{ label: "Schools", to: ROUTES.platform.schools.list, icon: "schools", anyOf: ["platform.schools.view"] },
	{ label: "Users", to: ROUTES.platform.users, icon: "users", anyOf: ["platform.users.manage"] },
	{ label: "Plans", to: ROUTES.platform.plans, icon: "plans", anyOf: ["platform.plans.view"] },
	{ label: "Subscriptions", to: ROUTES.platform.subscriptions, icon: "subscriptions", anyOf: ["platform.subscriptions.view"] },
	{ label: "Feedback", to: ROUTES.platform.feedback, icon: "feedback", anyOf: ["platform.feedback.manage"] },
	{ label: "Notifications", to: ROUTES.platform.notifications, icon: "notifications", anyOf: ["platform.notifications.view"] },
	{ label: "Settings", to: ROUTES.platform.settings, icon: "settings", anyOf: ["platform.settings.manage"] },
];

export function visibleNav(permissions: MyPermissions | null): NavEntry[] {
	if (!permissions) return [];
	const held = new Set(permissions.permissions.map((p) => p.key));
	const source = permissions.realm === "platform" ? PLATFORM_NAV : SCHOOL_NAV;
	return source.filter((e) => !e.anyOf || e.anyOf.some((k) => held.has(k)));
}

/** Where the bell's "see all" link goes. */
export function notificationsPath(realm: "school" | "platform"): string {
	return realm === "platform" ? ROUTES.platform.notifications : ROUTES.school.notifications;
}
