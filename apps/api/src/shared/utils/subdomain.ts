import { env } from "../../config/env";

/*
|--------------------------------------------------------------------------
| RESERVED SCHOOL SUBDOMAINS: the single place that decides whether a label may belong to a school.
| A label is reserved when, after trim + lowercase, it is
|   - in the built-in list below (labels a platform needs for itself: web, mail, DNS, operations, environments),
|   - the configured admin label (ADMIN_SUBDOMAIN), or
|   - listed in the optional RESERVED_SUBDOMAINS_EXTRA environment variable (comma separated).
| Used by self-registration and platform school creation. It knows nothing about hosts or tenants:
| tenant resolution (tenant-resolver.middleware.ts) is separate and unchanged.
|--------------------------------------------------------------------------
*/

export const RESERVED_SUBDOMAINS: readonly string[] = [
    // web and app
    "www", "admin", "api", "app", "portal", "login", "auth", "dashboard", "billing", "account", "accounts",
    "support", "help", "status", "docs", "blog", "static", "assets", "cdn", "media", "files",
    // mail and DNS
    "mail", "smtp", "imap", "pop", "pop3", "webmail", "mx", "ns", "ns1", "ns2", "autodiscover", "autoconfig", "ftp",
    // operations
    "git", "metrics", "monitor", "grafana", "health", "internal", "root", "platform", "superadmin", "system",
    // environments
    "dev", "test", "demo", "staging", "stage", "prod", "production", "sandbox", "preview",
];

export interface ReservedConfig { adminLabel: string; extra?: string }

export const normaliseSubdomain = (label: string): string => String(label ?? "").trim().toLowerCase();

const splitList = (list: string | undefined): string[] =>
    (list ?? "").split(",").map(normaliseSubdomain).filter(Boolean);

const defaultConfig = (): ReservedConfig => ({ adminLabel: env.ADMIN_SUBDOMAIN, extra: env.RESERVED_SUBDOMAINS_EXTRA });

/** Every label currently reserved (built-in + admin label + extras), normalised and without duplicates. */
export function reservedSubdomains(config: ReservedConfig = defaultConfig()): string[] {
    return [...new Set([...RESERVED_SUBDOMAINS, normaliseSubdomain(config.adminLabel), ...splitList(config.extra)].filter(Boolean))];
}

export function isReservedSubdomain(label: string, config: ReservedConfig = defaultConfig()): boolean {
    const wanted = normaliseSubdomain(label);
    return wanted !== "" && reservedSubdomains(config).includes(wanted);
}
