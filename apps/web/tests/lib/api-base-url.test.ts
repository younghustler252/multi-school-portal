import { describe, expect, it, vi } from "vitest";
import { apiBaseUrlFor, DEFAULT_API_HOST, getApiBaseUrl } from "@/lib/api/get-api-base-url";

/*
| Development hosts only. Production host derivation and custom domains are decided in Phase 2 (API-003 / TENANT-001),
| so they are deliberately not pinned here.
*/

describe("apiBaseUrlFor (development hosts)", () => {
	it("uses the API host as is when there is no browser (server render)", () => {
		expect(apiBaseUrlFor(null, "localhost:5000")).toBe("http://localhost:5000/api/v1");
	});

	it("uses the API host as is on the platform host", () => {
		expect(apiBaseUrlFor("localhost", "localhost:5000")).toBe("http://localhost:5000/api/v1");
	});

	it("carries a school's subdomain over to the API host", () => {
		expect(apiBaseUrlFor("greenfield.localhost", "localhost:5000")).toBe("http://greenfield.localhost:5000/api/v1");
	});

	it("lowercases the subdomain", () => {
		expect(apiBaseUrlFor("Greenfield.localhost", "localhost:5000")).toBe("http://greenfield.localhost:5000/api/v1");
	});

	it("falls back to port 5000 when the API host names no port", () => {
		expect(apiBaseUrlFor("greenfield.localhost", "localhost")).toBe("http://greenfield.localhost:5000/api/v1");
	});
});

describe("getApiBaseUrl", () => {
	it("defaults to the port apps/api listens on (5000), not 4000", () => {
		vi.stubEnv("NEXT_PUBLIC_API_HOST", "");
		vi.stubGlobal("window", { location: { hostname: "localhost" } });

		expect(DEFAULT_API_HOST).toBe("localhost:5000");
		expect(getApiBaseUrl()).toBe("http://localhost:5000/api/v1");
	});

	it("honours NEXT_PUBLIC_API_HOST on the platform host and on a school host", () => {
		vi.stubEnv("NEXT_PUBLIC_API_HOST", "localhost:6001");

		vi.stubGlobal("window", { location: { hostname: "localhost" } });
		expect(getApiBaseUrl()).toBe("http://localhost:6001/api/v1");

		vi.stubGlobal("window", { location: { hostname: "greenfield.localhost" } });
		expect(getApiBaseUrl()).toBe("http://greenfield.localhost:6001/api/v1");
	});

	it("works without a window (server render)", () => {
		vi.stubEnv("NEXT_PUBLIC_API_HOST", "localhost:5000");
		expect(getApiBaseUrl()).toBe("http://localhost:5000/api/v1");
	});
});
