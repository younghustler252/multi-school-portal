/*
|--------------------------------------------------------------------------
| API ORIGIN (browser → backend)
|--------------------------------------------------------------------------
| Set NEXT_PUBLIC_API_HOST (see apps/web/.env.local.example). The default is the
| port apps/api listens on in development (PORT=5000 in apps/api/.env.development.example).
|
| The backend picks the school from the request HOST (resolveTenant), so the school's
| subdomain is carried over to the API host:
|
|   localhost:3000                 → http://localhost:5000/api/v1               (platform / public)
|   greenfield.localhost:3000      → http://greenfield.localhost:5000/api/v1    (school "greenfield")
|
| Production host derivation and custom domains are NOT settled here yet: they are decided
| with the deployment owner in Phase 2 (API-003 / TENANT-001). The production branch below is
| unchanged from before and should not be relied on until then.
*/

export const DEFAULT_API_HOST = "localhost:5000";

// Not used yet: the admin host is currently recognised by lib/get-subdomain.ts. Settled in TENANT-001.
const ADMIN_SUBDOMAIN = process.env.NEXT_PUBLIC_ADMIN_SUBDOMAIN || "admin";

/**
 * Pure form of the rule (easy to test). `hostname` is the browser's hostname without port,
 * or null when rendering on the server.
 */
export function apiBaseUrlFor(hostname: string | null, apiHost: string): string {
	if (hostname === null) {
		return `http://${apiHost}/api/v1`;
	}

	const parts = hostname.split(".");

	const isLocalhostSubdomain = hostname.endsWith(".localhost");
	const hasSubdomain = isLocalhostSubdomain
		? parts.length > 1
		: parts.length > 2;

	if (!hasSubdomain) {
		return `http://${apiHost}/api/v1`;
	}

	const subdomain = parts[0].toLowerCase();

	// Only www should fall back to the base API host.
	if (subdomain === "www") {
		return `http://${apiHost}/api/v1`;
	}

	if (isLocalhostSubdomain) {
		const port = apiHost.split(":")[1] ?? "5000";
		return `http://${subdomain}.localhost:${port}/api/v1`;
	}

	// Production (unchanged, see the note above):
	// schoolos.com → school subdomain API
	const apiHostWithoutSubdomain =
		apiHost.split(".").slice(1).join(".") || apiHost;

	return `https://${subdomain}.${apiHostWithoutSubdomain}/api/v1`;
}

export function getApiBaseUrl(): string {
	// Read here (not at import time) so the value always reflects the environment it runs in.
	const apiHost = process.env.NEXT_PUBLIC_API_HOST || DEFAULT_API_HOST;
	return apiBaseUrlFor(typeof window === "undefined" ? null : window.location.hostname, apiHost);
}
