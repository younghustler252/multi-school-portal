import { NextRequest, NextResponse } from "next/server";
import { classifyHost, currentDeployment } from "@/lib/deployment";
import { decideRoute } from "@/lib/route-guard";
import { ROUTES, legacyRedirect } from "@/lib/routes";

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const hostname = request.headers.get("host") ?? "";
	const host = classifyHost(hostname, currentDeployment());
	if (host.kind === "admin" && pathname === ROUTES.auth.login) {
		const url = request.nextUrl.clone();
		url.pathname = ROUTES.auth.adminLogin;
		return NextResponse.rewrite(url);
	}
	// On a school's address (its subdomain or its own verified domain), /login rewrites internally to the
	// school login page; the URL stays "/login" for the user.
	if ((host.kind === "school" || host.kind === "custom") && pathname === ROUTES.auth.login) {
		const url = request.nextUrl.clone();
		url.pathname = ROUTES.auth.portalLogin;
		return NextResponse.rewrite(url);
	}


	// Old role-named addresses (bookmarks, old emails) go to the feature route, keeping the rest of the path and the query.
	const moved = legacyRedirect(pathname);
	if (moved) {
		const url = request.nextUrl.clone();
		url.pathname = moved;
		return NextResponse.redirect(url, 308);
	}

	const decision = decideRoute({
		pathname,
		hasAccessCookie: request.cookies.has("accessToken"),
		hasRefreshCookie: request.cookies.has("refreshToken"),
	});

	if (decision.action === "redirect-home") return NextResponse.redirect(new URL("/", request.url));
	if (decision.action === "login") {
		const loginUrl = new URL(ROUTES.auth.login, request.url);
		loginUrl.searchParams.set("redirect", decision.returnTo);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};