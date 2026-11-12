import { describe, expect, it } from "vitest";
import { decideRoute } from "@/lib/route-guard";
import { ROUTES } from "@/lib/routes";

const none = { hasAccessCookie: false, hasRefreshCookie: false };
const both = { hasAccessCookie: true, hasRefreshCookie: true };
const refreshOnly = { hasAccessCookie: false, hasRefreshCookie: true };

describe("decideRoute: protected pages", () => {
	it("sends a visitor with no cookies to /login and remembers where they were going", () => {
		expect(decideRoute({ pathname: ROUTES.school.fees.list, ...none })).toEqual({ action: "login", returnTo: ROUTES.school.fees.list });
	});

	it("lets a signed-in visitor through", () => {
		expect(decideRoute({ pathname: ROUTES.school.fees.list, ...both })).toEqual({ action: "next" });
	});

	it("lets a visitor with ONLY the refresh cookie through (the access cookie expired after 15 minutes; the client refreshes)", () => {
		expect(decideRoute({ pathname: ROUTES.school.fees.list, ...refreshOnly })).toEqual({ action: "next" });
		expect(decideRoute({ pathname: "/home", ...refreshOnly })).toEqual({ action: "next" });
	});

	it("protects the new /home landing page", () => {
		expect(decideRoute({ pathname: "/home", ...none })).toEqual({ action: "login", returnTo: "/home" });
	});

	it("does not treat a look-alike path as protected", () => {
		expect(decideRoute({ pathname: "/homepage-news", ...none })).toEqual({ action: "next" });
	});
});

describe("decideRoute: auth pages", () => {
	it("bounces a person with a live session away from /login", () => {
		expect(decideRoute({ pathname: "/login", ...both })).toEqual({ action: "redirect-home" });
	});

	it("does NOT bounce on a refresh cookie alone (it may be dead; bouncing could loop)", () => {
		expect(decideRoute({ pathname: "/login", ...refreshOnly })).toEqual({ action: "next" });
	});

	it("shows /login to a visitor with no cookies", () => {
		expect(decideRoute({ pathname: "/login", ...none })).toEqual({ action: "next" });
	});
});

describe("decideRoute: public pages", () => {
	it("never interferes with the marketing site or the impersonation entry", () => {
		expect(decideRoute({ pathname: "/", ...none })).toEqual({ action: "next" });
		expect(decideRoute({ pathname: "/impersonate-entry", ...none })).toEqual({ action: "next" });
	});
});
