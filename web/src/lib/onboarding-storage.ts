const KEY = "schoolos_pending_subdomain";

export function saveSubdomain(subdomain: string) {
	sessionStorage.setItem(KEY, subdomain);
}

export function getSavedSubdomain(): string | null {
	return sessionStorage.getItem(KEY);
}

export function clearSavedSubdomain() {
	sessionStorage.removeItem(KEY);
}