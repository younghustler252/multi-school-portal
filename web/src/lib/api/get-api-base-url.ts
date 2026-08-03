const API_HOST = process.env.NEXT_PUBLIC_API_HOST || "localhost:4000";
const ADMIN_SUBDOMAIN = process.env.NEXT_PUBLIC_ADMIN_SUBDOMAIN || "admin";

/**
 * Builds the API base URL using the CURRENT browser subdomain, so backend's
 * resolveTenant middleware (which reads req.headers.host) resolves the
 * correct school schema automatically — no manual headers needed.
 *
 * greenfield.localhost:3000 (frontend) → http://greenfield.localhost:4000/api (backend)
 * localhost:3000 (no subdomain)        → http://localhost:4000/api (public schema)
 */
export function getApiBaseUrl(): string {
	if (typeof window === "undefined") {
		return `http://${API_HOST}/api/v1`;
	}

	const currentHost = window.location.hostname;
	const parts = currentHost.split(".");

	const isLocalhostSubdomain = currentHost.endsWith(".localhost");
	const hasSubdomain = isLocalhostSubdomain ? parts.length > 1 : parts.length > 2;

	if (!hasSubdomain) {
		return `http://${API_HOST}/api/v1`;
	}

	const subdomain = parts[0].toLowerCase();

	if (subdomain === "www" || subdomain === ADMIN_SUBDOMAIN) {
		return `http://${API_HOST}/api/v1`;
	}

	const apiHostWithoutSubdomain =
		API_HOST.split(".")
			.slice(isLocalhostSubdomain ? 0 : 1)
			.join(".") || API_HOST;

	return `http://${subdomain}.${apiHostWithoutSubdomain}/api/v1`;
}