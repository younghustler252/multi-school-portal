/*
| Breadcrumb trail from a URL path. Pure: no React, no imports. The caller passes the pages that really exist and have a
| label (the menu entries), so a crumb is a link only when it points at a real page. Nothing is guessed about routes.
|
|   /school/students/8f2c...  ->  School / Students (link) / Details
|   /school/staff/new         ->  School / Staff (link) / New
|   /school/students          ->  (none: the page title already says where you are)
|   /home                     ->  (none)
*/

export interface Crumb {
	label: string;
	/** null = shown as text: either the current page or a section that is not a page of its own. */
	href: string | null;
}

export interface KnownPage {
	path: string;
	label: string;
}

const WORD = /^[a-z]+(?:-[a-z]+)*$/;

function humanize(segment: string): string {
	const text = segment.replace(/-/g, " ");
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelFor(path: string, segment: string, known: Map<string, string>): string {
	const exact = known.get(path);
	if (exact) return exact;
	if (segment === "new") return "New";
	// Anything that is not a plain lowercase word (a UUID, a database id) is a record, not a section.
	if (!WORD.test(segment)) return "Details";
	return humanize(segment);
}

/**
 * Returns [] when the trail would add nothing: a single page, or no earlier crumb that can be opened.
 * The last crumb is always the current page and never a link.
 */
export function buildBreadcrumbs(pathname: string, pages: KnownPage[]): Crumb[] {
	const clean = pathname.split(/[?#]/)[0] ?? "";
	const segments = clean.split("/").filter(Boolean);
	if (segments.length < 2) return [];

	const known = new Map(pages.map((page) => [page.path, page.label]));
	const crumbs: Crumb[] = segments.map((segment, index) => {
		const path = "/" + segments.slice(0, index + 1).join("/");
		const isLast = index === segments.length - 1;
		return { label: labelFor(path, segment, known), href: !isLast && known.has(path) ? path : null };
	});

	return crumbs.some((crumb) => crumb.href !== null) ? crumbs : [];
}
