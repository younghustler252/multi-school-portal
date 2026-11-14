import { describe, expect, it } from "vitest";
import { imageHostsFor, isLocalHost, PUBLIC_FILE_PATH } from "@/config/image-hosts";

describe("imageHostsFor: the picture rules follow the configured Supabase address", () => {
	it("hosted project: that project's host only, https, public-file path only", () => {
		const r = imageHostsFor("https://abcd1234.supabase.co", "production");
		expect(r.patterns).toEqual([{ protocol: "https", hostname: "abcd1234.supabase.co", pathname: PUBLIC_FILE_PATH }]);
		expect(r.usedFallback).toBe(false); expect(r.allowLocalIp).toBe(false);
	});
	it("custom domain: the custom host, not *.supabase.co", () => {
		const r = imageHostsFor("https://files.example.com/", "production");
		expect(r.patterns[0]).toEqual({ protocol: "https", hostname: "files.example.com", pathname: PUBLIC_FILE_PATH });
	});
	it("a trailing path or spaces in the value do not leak into the rule", () => {
		expect(imageHostsFor("  https://files.example.com/some/path  ", "production").patterns[0]).toEqual({ protocol: "https", hostname: "files.example.com", pathname: PUBLIC_FILE_PATH });
	});
	it("local Supabase: http, localhost and the port are kept; the local-address switch is on in development only", () => {
		const dev = imageHostsFor("http://localhost:54321", "development");
		expect(dev.patterns[0]).toEqual({ protocol: "http", hostname: "localhost", port: "54321", pathname: PUBLIC_FILE_PATH });
		expect(dev.allowLocalIp).toBe(true);
		expect(imageHostsFor("http://localhost:54321", "production").allowLocalIp).toBe(false);
		expect(imageHostsFor("http://127.0.0.1:54321", "development").allowLocalIp).toBe(true);
	});
	it("a public host never switches the local-address override on", () => {
		expect(imageHostsFor("https://abcd.supabase.co", "development").allowLocalIp).toBe(false);
	});
	it("missing, empty or broken values fall back to the old narrow wildcard and say so", () => {
		for (const v of [undefined, "", "not a url", "ftp://x.example.com", "javascript:alert(1)"]) {
			const r = imageHostsFor(v, "production");
			expect(r.usedFallback, String(v)).toBe(true);
			expect(r.patterns).toEqual([{ protocol: "https", hostname: "*.supabase.co", pathname: PUBLIC_FILE_PATH }]);
		}
	});
	it("a rule is never wider than the public-file path (no host-wide access)", () => {
		for (const v of ["https://abcd.supabase.co", "http://localhost:54321", undefined]) expect(imageHostsFor(v).patterns.every(p => p.pathname === PUBLIC_FILE_PATH)).toBe(true);
	});
});

describe("isLocalHost", () => {
	it("recognises local and private addresses", () => {
		for (const h of ["localhost", "files.localhost", "127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "172.31.255.1", "[::1]"]) expect(isLocalHost(h), h).toBe(true);
	});
	it("and not public ones", () => {
		for (const h of ["abcd.supabase.co", "example.com", "8.8.8.8", "172.32.0.1", "172.15.0.1", "192.169.0.1"]) expect(isLocalHost(h), h).toBe(false);
	});
});
