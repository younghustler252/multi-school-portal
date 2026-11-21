import { describe, expect, it } from "vitest";
import { isNavActive } from "@/lib/nav-active";

describe("isNavActive", () => {
	it("matches the exact path", () => {
		expect(isNavActive("/school/students", "/school/students")).toBe(true);
	});

	it("keeps the parent entry current on nested pages", () => {
		expect(isNavActive("/school/students/123", "/school/students")).toBe(true);
		expect(isNavActive("/school/students/new", "/school/students")).toBe(true);
	});

	it("matches on a path boundary, not on a shared prefix", () => {
		expect(isNavActive("/school/staffing", "/school/staff")).toBe(false);
	});

	it("does not match unrelated pages", () => {
		expect(isNavActive("/school/fees", "/school/students")).toBe(false);
	});

	it("makes the home entry current only on its own path", () => {
		expect(isNavActive("/home", "/home", "/home")).toBe(true);
		expect(isNavActive("/home/anything", "/home", "/home")).toBe(false);
	});

	it("makes a dashboard entry current only on its own path", () => {
		expect(isNavActive("/school/dashboard", "/school/dashboard")).toBe(true);
		expect(isNavActive("/school/dashboard/extra", "/school/dashboard")).toBe(false);
	});
});
