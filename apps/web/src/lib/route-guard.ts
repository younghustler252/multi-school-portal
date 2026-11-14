import { AUTH_PAGES, PROTECTED_ROOTS } from "@/lib/routes";

/*
| The routing decision middleware.ts makes before a page renders (AUTH-005). Pure, so it is tested without Next.
|
| The access cookie lives 15 minutes; the refresh cookie lives 7 days (both path "/"). So "signed in" for the purpose of
| letting a protected page load is: EITHER cookie is present. With only the refresh cookie the page loads, the client's
| first request gets TOKEN_MISSING, the single-flight refresh runs, and the session continues without the user noticing.
| If that refresh fails, the SessionGate sends the person to /login. The API still decides every request.
|
| Bouncing a signed-in person away from /login is different: it needs a LIVE session (access cookie), otherwise a dead
| refresh cookie would trap the person in a redirect loop between /login and a page that cannot load.
*/

export const AUTH_ROUTES: readonly string[] = AUTH_PAGES;

// Derived from the route registry so a renamed area is protected automatically.
export const PROTECTED_PREFIXES: readonly string[] = PROTECTED_ROOTS;

export type RouteDecision = { action: "next" } | { action: "redirect-home" } | { action: "login"; returnTo: string };

export function decideRoute(input: { pathname: string; hasAccessCookie: boolean; hasRefreshCookie: boolean }): RouteDecision {
	const { pathname, hasAccessCookie, hasRefreshCookie } = input;
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
	const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));

	if (isAuthRoute && hasAccessCookie) return { action: "redirect-home" };
	if (isProtectedRoute && !hasAccessCookie && !hasRefreshCookie) return { action: "login", returnTo: pathname };
	return { action: "next" };
}
