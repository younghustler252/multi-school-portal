/*
|--------------------------------------------------------------------------
| DEPLOYMENT CONFIGURATION (TENANT-001 / API-003)
|--------------------------------------------------------------------------
| Everything that depends on WHERE the app is hosted lives here and comes from environment variables.
| No domain name is written anywhere else in the web app.
|
|   NEXT_PUBLIC_BASE_DOMAIN        the platform's domain. Same value as the API's BASE_DOMAIN.   dev: localhost
|   NEXT_PUBLIC_ADMIN_SUBDOMAIN    platform administration host label. Same as the API's.        default: admin
|   NEXT_PUBLIC_PUBLIC_SUBDOMAINS  extra host labels that serve the platform itself (comma list) default: www
|                                  (the API only treats base, www and the admin label as the platform; add a label here
|                                   only together with the matching change in apps/api tenant-resolver)
|   NEXT_PUBLIC_API_URL            full API base incl. /api/v1: "/api/v1" (same origin) or "https://api.<domain>/api/v1".
|                                  Unset in development: derived from NEXT_PUBLIC_API_HOST (lib/api/get-api-base-url.ts).
|   NEXT_PUBLIC_WEB_PORT           port in generated links. Default 3000 on a localhost base domain, none otherwise.
|
| Host classification mirrors apps/api/src/infrastructure/middleware/tenant-resolver.middleware.ts (classifyHost).
| Keep the two in step: the web app must call a host "a school" exactly when the API does.
| Pure, so it is tested without Next.
*/

export interface Deployment {
	baseDomain: string;
	adminSubdomain: string;
	publicSubdomains: string[];
	apiUrl: string | null;
	protocol: "http" | "https";
	webPort: string;
}

type Env = Partial<Record<
	"NEXT_PUBLIC_BASE_DOMAIN" | "NEXT_PUBLIC_ADMIN_SUBDOMAIN" | "NEXT_PUBLIC_PUBLIC_SUBDOMAINS" | "NEXT_PUBLIC_API_URL" | "NEXT_PUBLIC_WEB_PORT",
	string | undefined
>>;

const clean = (v: string | undefined): string => (v ?? "").trim();

function isLocalBase(base: string): boolean {
	return base === "localhost" || base.endsWith(".localhost");
}

export function readDeployment(env: Env): Deployment {
	const baseDomain = (clean(env.NEXT_PUBLIC_BASE_DOMAIN) || "localhost").toLowerCase().replace(/^\.+|\.+$/g, "");
	const local = isLocalBase(baseDomain);

	const rawApi = clean(env.NEXT_PUBLIC_API_URL).replace(/\/+$/, "");
	const apiUrl = rawApi.startsWith("/") || /^https?:\/\//i.test(rawApi) ? rawApi : null;

	const extra = clean(env.NEXT_PUBLIC_PUBLIC_SUBDOMAINS)
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	return {
		baseDomain,
		adminSubdomain: (clean(env.NEXT_PUBLIC_ADMIN_SUBDOMAIN) || "admin").toLowerCase(),
		publicSubdomains: Array.from(new Set(["www", ...extra])),
		apiUrl,
		protocol: local ? "http" : "https", // production is always https
		webPort: clean(env.NEXT_PUBLIC_WEB_PORT) || (local ? "3000" : ""),
	};
}

/*
| Next.js only inlines NEXT_PUBLIC_* into browser code when each variable is written out literally
| (process.env.NEXT_PUBLIC_X). Passing `process.env` as a whole would be empty in the browser, so each one is named here.
*/
export function currentDeployment(): Deployment {
	return readDeployment({
		NEXT_PUBLIC_BASE_DOMAIN: process.env.NEXT_PUBLIC_BASE_DOMAIN,
		NEXT_PUBLIC_ADMIN_SUBDOMAIN: process.env.NEXT_PUBLIC_ADMIN_SUBDOMAIN,
		NEXT_PUBLIC_PUBLIC_SUBDOMAINS: process.env.NEXT_PUBLIC_PUBLIC_SUBDOMAINS,
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
		NEXT_PUBLIC_WEB_PORT: process.env.NEXT_PUBLIC_WEB_PORT,
	});
}

// ── Host classification ──────────────────────────────────────────────────

export type HostKind =
	| { kind: "platform" } // base domain, www, or another public label: marketing site, platform login
	| { kind: "admin" } // platform administration
	| { kind: "school"; subdomain: string } // <subdomain>.<base domain>
	| { kind: "custom"; hostname: string } // anything else: a school's own verified domain
	| { kind: "invalid" }; // a.b.<base domain> is never a school

export function classifyHost(hostname: string, d: Deployment): HostKind {
	const host = hostname.split(":")[0].trim().toLowerCase();
	const base = d.baseDomain;

	if (!host || host === base) return { kind: "platform" };

	if (host.endsWith(`.${base}`)) {
		const label = host.slice(0, -(base.length + 1));
		if (label.includes(".")) return { kind: "invalid" };
		if (label === d.adminSubdomain) return { kind: "admin" };
		if (d.publicSubdomains.includes(label)) return { kind: "platform" };
		return { kind: "school", subdomain: label };
	}

	return { kind: "custom", hostname: host };
}

/** The school's subdomain when this host is a `<subdomain>.<base>` school address, otherwise null. */
export function schoolSubdomainOf(hostname: string, d: Deployment): string | null {
	const k = classifyHost(hostname, d);
	return k.kind === "school" ? k.subdomain : null;
}

// ── Link building ────────────────────────────────────────────────────────

function originFor(d: Deployment, host: string): string {
	return `${d.protocol}://${host}${d.webPort ? `:${d.webPort}` : ""}`;
}

const withPath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

/** A school's address from its subdomain. A school with a verified custom domain should be linked by the `url` the API sends. */
export function schoolUrl(d: Deployment, subdomain: string, path = "/"): string {
	return `${originFor(d, `${subdomain.toLowerCase()}.${d.baseDomain}`)}${withPath(path)}`;
}

export function adminUrl(d: Deployment, path = "/"): string {
	return `${originFor(d, `${d.adminSubdomain}.${d.baseDomain}`)}${withPath(path)}`;
}

export function platformUrl(d: Deployment, path = "/"): string {
	return `${originFor(d, d.baseDomain)}${withPath(path)}`;
}

/** "greenfield.example.com": for showing an address as text. */
export function schoolHostLabel(d: Deployment, subdomain: string): string {
	return `${subdomain.toLowerCase()}.${d.baseDomain}`;
}
