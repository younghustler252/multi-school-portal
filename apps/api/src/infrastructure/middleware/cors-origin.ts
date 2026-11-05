/*
| WHICH BROWSER ORIGINS MAY CALL THE API.
| Allowed: the platform's own domain and any subdomain of it, over https (BASE_DOMAIN in the environment: the school hosts,
| the admin host and the marketing site all live there). Requests with no Origin (server to server, health checks) pass.
| In development every origin is allowed. The match is anchored at both ends, so "https://evil.com/?a.yourschool.com" or
| "https://notyourschool.com" never match.
*/
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function isAllowedOrigin(origin: string | undefined, baseDomain: string, nodeEnv: string): boolean {
    if (!origin) return true;
    if (nodeEnv === "development") return true;
    const host = baseDomain.trim().toLowerCase();
    if (!host) return false;
    return new RegExp(`^https://([a-z0-9-]+\\.)*${escape(host)}$`, "i").test(origin);
}
