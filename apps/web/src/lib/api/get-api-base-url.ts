import { currentDeployment } from "@/lib/deployment";

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
| PRODUCTION: set NEXT_PUBLIC_API_URL (lib/deployment.ts, docs/frontend/DEPLOYMENT.md). When it is set it is used as is and
| nothing below runs. The host derivation below is the development rule; its production branch predates the deployment
| design and is kept only as a fallback so an unconfigured build behaves as it did before.
*/

export const DEFAULT_API_HOST = "localhost:5000";

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
	// An explicit API URL (production, or any deployment where the API is not on the derived host) always wins.
	const configured = currentDeployment().apiUrl;
	if (configured) return configured;

	// Read here (not at import time) so the value always reflects the environment it runs in.
	const apiHost = process.env.NEXT_PUBLIC_API_HOST || DEFAULT_API_HOST;
	return apiBaseUrlFor(typeof window === "undefined" ? null : window.location.hostname, apiHost);
}
