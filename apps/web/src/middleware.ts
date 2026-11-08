import { NextRequest, NextResponse } from "next/server";
import { extractSubdomain, isAdminSubdomain } from "@/lib/get-subdomain";
import { decideRoute } from "@/lib/route-guard";

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const hostname = request.headers.get("host") ?? "";
	const subdomain = extractSubdomain(hostname);
	if (isAdminSubdomain(hostname) && pathname === "/login") {
		const url = request.nextUrl.clone();
		url.pathname = "/admin-login";
		return NextResponse.rewrite(url);
	}
	// On a school's subdomain, /login rewrites internally to the
	// subdomain-branded login page — URL stays "/login" for the user.
	if (subdomain && pathname === "/login") {
		const url = request.nextUrl.clone();
		url.pathname = "/portal-login";
		return NextResponse.rewrite(url);
	}


	const decision = decideRoute({
		pathname,
		hasAccessCookie: request.cookies.has("accessToken"),
		hasRefreshCookie: request.cookies.has("refreshToken"),
	});

	if (decision.action === "redirect-home") return NextResponse.redirect(new URL("/", request.url));
	if (decision.action === "login") {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", decision.returnTo);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};