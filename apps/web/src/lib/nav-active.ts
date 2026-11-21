/*
| Which menu entry is "current" for a URL. Pure: no React, no imports. One rule for every sidebar.
|   - the exact path is always current;
|   - a nested page (/school/students/123) keeps its parent entry (/school/students) current, matched on a path boundary
|     so "/school/staff" is not current for "/school/staffing";
|   - the home entry and dashboard entries are current only on their exact path, otherwise they would light up everywhere
|     under their section.
*/
export function isNavActive(pathname: string, to: string, homePath?: string): boolean {
	if (pathname === to) return true;
	if (to === homePath || to.endsWith("/dashboard")) return false;
	return pathname.startsWith(to.endsWith("/") ? to : `${to}/`);
}
