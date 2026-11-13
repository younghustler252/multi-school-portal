import type { MyPermissions, PersonaType } from "@schoolos/contracts";
import { ROUTES } from "@/lib/routes";
import {
	NAV_GROUP_LABEL, NAV_GROUP_VISIBLE, PLATFORM_ROUTE_RULES, SCHOOL_ROUTE_RULES, rulesFor, satisfies,
	type NavGroup, type NavIcon, type RouteRule,
} from "@/lib/route-access";

export type { NavGroup, NavIcon };

/*
| Navigation as data (AUTHZ-003). There is NO separate menu list: the menu is the labelled rules in route-access.ts,
| shown when the session satisfies the same rule the route guard uses (persona, permission, scope). A menu entry and its
| page therefore cannot disagree. Pure and icon-free so it is tested on its own. Role names are never consulted.
| Hiding an entry is a convenience; the API still enforces access.
*/

export interface NavEntry {
	label: string;
	to: string;
	icon: NavIcon;
	group: NavGroup | null;
	groupLabel: string | null;
	/** The rule behind the entry, for tests and for pages that want to explain why something is missing. */
	rule: RouteRule;
}

const toEntry = (rule: RouteRule): NavEntry => ({
	label: rule.label as string, to: rule.path, icon: rule.icon as NavIcon,
	group: rule.group ?? null, groupLabel: rule.group ? NAV_GROUP_LABEL[rule.group] : null, rule,
});

/** Every menu entry that exists, before any session filtering. */
export const SCHOOL_NAV: NavEntry[] = SCHOOL_ROUTE_RULES.filter((r) => r.label && r.icon).map(toEntry);
export const PLATFORM_NAV: NavEntry[] = PLATFORM_ROUTE_RULES.filter((r) => r.label && r.icon).map(toEntry);

export function visibleNav(permissions: MyPermissions | null): NavEntry[] {
	if (!permissions) return [];
	const rules = rulesFor(permissions);
	const shown = rules.filter((r) => r.label && r.icon && satisfies(r, permissions) && (!r.group || NAV_GROUP_VISIBLE[r.group](permissions)));
	const shownPaths = new Set(shown.map((r) => r.path));
	// A page replaced by a workspace version is listed once.
	return shown.filter((r) => !(r.supersededBy && shownPaths.has(r.supersededBy))).map(toEntry);
}

/**
 * Where the bell's "see all" link goes, or null when the session has no inbox page (students). The bell then says so
 * instead of linking somewhere that is not an inbox.
 */
export function notificationsPath(realm: "school" | "platform", persona?: PersonaType | null): string | null {
	if (realm === "platform") return ROUTES.platform.notifications;
	if (persona === "GUARDIAN") return ROUTES.family.notifications;
	if (persona === "STUDENT") return null;
	return ROUTES.school.notifications;
}
