import { describe, expect, it } from "vitest";
import { buildBreadcrumbs, type KnownPage } from "@/lib/breadcrumbs";

const pages: KnownPage[] = [
	{ path: "/school/students", label: "Students" },
	{ path: "/school/staff", label: "Staff" },
	{ path: "/schools", label: "Schools" },
];
const UUID = "8f2c1d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

describe("buildBreadcrumbs", () => {
	it("shows a trail for a record page, linking only pages that exist", () => {
		expect(buildBreadcrumbs(`/school/students/${UUID}`, pages)).toEqual([
			{ label: "School", href: null },
			{ label: "Students", href: "/school/students" },
			{ label: "Details", href: null },
		]);
	});

	it("names a create page 'New'", () => {
		expect(buildBreadcrumbs("/school/staff/new", pages)).toEqual([
			{ label: "School", href: null },
			{ label: "Staff", href: "/school/staff" },
			{ label: "New", href: null },
		]);
	});

	it("works for a two-segment record page (platform schools)", () => {
		expect(buildBreadcrumbs(`/schools/${UUID}`, pages)).toEqual([
			{ label: "Schools", href: "/schools" },
			{ label: "Details", href: null },
		]);
	});

	it("shows nothing on a list page: the page title already says where you are", () => {
		expect(buildBreadcrumbs("/school/students", pages)).toEqual([]);
	});

	it("shows nothing for a single segment or the root", () => {
		expect(buildBreadcrumbs("/home", pages)).toEqual([]);
		expect(buildBreadcrumbs("/", pages)).toEqual([]);
	});

	it("shows nothing when no earlier crumb can be opened", () => {
		expect(buildBreadcrumbs("/school/enrolment/promote", pages)).toEqual([]);
	});

	it("ignores a query string, a hash and a trailing slash", () => {
		expect(buildBreadcrumbs("/school/staff/new/?x=1#top", pages)).toEqual(buildBreadcrumbs("/school/staff/new", pages));
	});

	it("never makes the current page a link", () => {
		const trail = buildBreadcrumbs("/school/students/new", pages);
		expect(trail[trail.length - 1]?.href).toBeNull();
	});
});
