import { describe, expect, it } from "vitest";
import { adminUrl, classifyHost, platformUrl, readDeployment, schoolHostLabel, schoolSubdomainOf, schoolUrl } from "@/lib/deployment";

const prod = readDeployment({ NEXT_PUBLIC_BASE_DOMAIN: "example.com" });
const dev = readDeployment({});

describe("readDeployment", () => {
	it("defaults to a local development setup: localhost, http, port 3000, admin label, no explicit API URL", () => {
		expect(dev.baseDomain).toBe("localhost");
		expect(dev.protocol).toBe("http");
		expect(dev.webPort).toBe("3000");
		expect(dev.adminSubdomain).toBe("admin");
		expect(dev.apiUrl).toBeNull();
		expect(dev.publicSubdomains).toEqual(["www"]);
	});

	it("a real domain means https and no port in links", () => {
		expect(prod.protocol).toBe("https");
		expect(prod.webPort).toBe("");
	});

	it("normalizes the values it is given (case, stray dots, spaces)", () => {
		const d = readDeployment({ NEXT_PUBLIC_BASE_DOMAIN: " .Example.COM. ", NEXT_PUBLIC_ADMIN_SUBDOMAIN: " Console " });
		expect(d.baseDomain).toBe("example.com");
		expect(d.adminSubdomain).toBe("console");
	});

	it("accepts a same-origin or an absolute API URL, drops a trailing slash, and ignores anything else", () => {
		expect(readDeployment({ NEXT_PUBLIC_API_URL: "/api/v1/" }).apiUrl).toBe("/api/v1");
		expect(readDeployment({ NEXT_PUBLIC_API_URL: "https://api.example.com/api/v1" }).apiUrl).toBe("https://api.example.com/api/v1");
		expect(readDeployment({ NEXT_PUBLIC_API_URL: "api.example.com" }).apiUrl).toBeNull();
		expect(readDeployment({ NEXT_PUBLIC_API_URL: "javascript:alert(1)" }).apiUrl).toBeNull();
		expect(readDeployment({ NEXT_PUBLIC_API_URL: "" }).apiUrl).toBeNull();
	});

	it("adds extra platform host labels on top of www", () => {
		expect(readDeployment({ NEXT_PUBLIC_PUBLIC_SUBDOMAINS: "app, Portal ,," }).publicSubdomains).toEqual(["www", "app", "portal"]);
	});

	it("an explicit web port wins", () => {
		expect(readDeployment({ NEXT_PUBLIC_WEB_PORT: "8080" }).webPort).toBe("8080");
	});
});

describe("classifyHost: same rules as the API's tenant resolver", () => {
	it("the base domain and www are the platform", () => {
		expect(classifyHost("example.com", prod)).toEqual({ kind: "platform" });
		expect(classifyHost("www.example.com", prod)).toEqual({ kind: "platform" });
	});

	it("the admin label is the admin host", () => {
		expect(classifyHost("admin.example.com", prod)).toEqual({ kind: "admin" });
	});

	it("any other single label is a school", () => {
		expect(classifyHost("greenfield.example.com", prod)).toEqual({ kind: "school", subdomain: "greenfield" });
	});

	it("'app' and 'api' are schools unless configured as platform labels (the API reads them the same way)", () => {
		expect(classifyHost("app.example.com", prod)).toEqual({ kind: "school", subdomain: "app" });
		expect(classifyHost("api.example.com", prod)).toEqual({ kind: "school", subdomain: "api" });
		const withApp = readDeployment({ NEXT_PUBLIC_BASE_DOMAIN: "example.com", NEXT_PUBLIC_PUBLIC_SUBDOMAINS: "app" });
		expect(classifyHost("app.example.com", withApp)).toEqual({ kind: "platform" });
	});

	it("a.b.<base> is never a school", () => {
		expect(classifyHost("a.b.example.com", prod)).toEqual({ kind: "invalid" });
	});

	it("an unrelated domain is a school's custom domain", () => {
		expect(classifyHost("portal.greenfield.edu.ng", prod)).toEqual({ kind: "custom", hostname: "portal.greenfield.edu.ng" });
	});

	it("does not mistake a look-alike domain for the platform", () => {
		expect(classifyHost("notexample.com", prod)).toEqual({ kind: "custom", hostname: "notexample.com" });
		expect(classifyHost("example.com.evil.test", prod)).toEqual({ kind: "custom", hostname: "example.com.evil.test" });
	});

	it("ignores the port and the case", () => {
		expect(classifyHost("Greenfield.Example.com:443", prod)).toEqual({ kind: "school", subdomain: "greenfield" });
	});

	it("works on localhost for development", () => {
		expect(classifyHost("localhost:3000", dev)).toEqual({ kind: "platform" });
		expect(classifyHost("greenfield.localhost:3000", dev)).toEqual({ kind: "school", subdomain: "greenfield" });
		expect(classifyHost("admin.localhost:3000", dev)).toEqual({ kind: "admin" });
		expect(classifyHost("www.localhost", dev)).toEqual({ kind: "platform" });
	});

	it("an empty host is the platform", () => {
		expect(classifyHost("", prod)).toEqual({ kind: "platform" });
	});

	it("schoolSubdomainOf returns a subdomain only for school hosts", () => {
		expect(schoolSubdomainOf("greenfield.example.com", prod)).toBe("greenfield");
		expect(schoolSubdomainOf("admin.example.com", prod)).toBeNull();
		expect(schoolSubdomainOf("portal.greenfield.edu.ng", prod)).toBeNull();
		expect(schoolSubdomainOf("example.com", prod)).toBeNull();
	});
});

describe("link building", () => {
	it("production links are https with no port and use the configured domain", () => {
		expect(schoolUrl(prod, "Greenfield", "/login")).toBe("https://greenfield.example.com/login");
		expect(adminUrl(prod, "/dashboard")).toBe("https://admin.example.com/dashboard");
		expect(platformUrl(prod)).toBe("https://example.com/");
	});

	it("development links are http with the dev port", () => {
		expect(schoolUrl(dev, "greenfield", "/school-admin/dashboard")).toBe("http://greenfield.localhost:3000/school-admin/dashboard");
		expect(adminUrl(dev, "/dashboard")).toBe("http://admin.localhost:3000/dashboard");
		expect(platformUrl(dev, "/login")).toBe("http://localhost:3000/login");
	});

	it("adds a missing leading slash", () => {
		expect(schoolUrl(prod, "g", "login")).toBe("https://g.example.com/login");
	});

	it("uses a different admin label when configured", () => {
		const d = readDeployment({ NEXT_PUBLIC_BASE_DOMAIN: "example.com", NEXT_PUBLIC_ADMIN_SUBDOMAIN: "console" });
		expect(adminUrl(d, "/x")).toBe("https://console.example.com/x");
		expect(classifyHost("console.example.com", d)).toEqual({ kind: "admin" });
		expect(classifyHost("admin.example.com", d)).toEqual({ kind: "school", subdomain: "admin" });
	});

	it("labels an address for display", () => {
		expect(schoolHostLabel(prod, "Greenfield")).toBe("greenfield.example.com");
	});
});
