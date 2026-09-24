const KEY = "schoolos_last_portal";

type LastPortal = { type: "school"; subdomain: string } | { type: "super_admin" };

export function saveLastPortal(portal: LastPortal) {
	localStorage.setItem(KEY, JSON.stringify(portal));
}

export function getLastPortal(): LastPortal | null {
	const raw = localStorage.getItem(KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as LastPortal;
	} catch {
		return null;
	}
}

export function clearLastPortal() {
	localStorage.removeItem(KEY);
}