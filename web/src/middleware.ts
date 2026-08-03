import { NextRequest, NextResponse } from "next/server";
import { extractSubdomain } from "@/lib/get-subdomain";

const AUTH_ROUTES = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password"];

const PROTECTED_PREFIXES = [
	"/school-admin", "/teacher", "/bursar", "/principal",
	"/student", "/guardian", "/schools", "/plans", "/subscriptions",
];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const hostname = request.headers.get("host") ?? "";
	const subdomain = extractSubdomain(hostname);
	const hasSession = request.cookies.has("accessToken");

	// On a school's subdomain, /login rewrites internally to the
	// subdomain-branded login page — URL stays "/login" for the user.
	if (subdomain && pathname === "/login") {
		const url = request.nextUrl.clone();
		url.pathname = "/portal-login";
		return NextResponse.rewrite(url);
	}

	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
	const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

	if (isAuthRoute && hasSession) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	if (isProtectedRoute && !hasSession) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};