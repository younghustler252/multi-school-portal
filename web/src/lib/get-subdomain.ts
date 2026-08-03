const ADMIN_SUBDOMAIN = "admin";

export function extractSubdomain(hostname: string): string | null {
	const hostWithoutPort = hostname.split(":")[0];
	const isLocalhostSub = hostWithoutPort.endsWith(".localhost");
	const parts = hostWithoutPort.split(".");

	const hasSubdomain = isLocalhostSub ? parts.length > 1 : parts.length > 2;
	if (!hasSubdomain) return null;

	const subdomain = parts[0].toLowerCase();
	if (subdomain === "www" || subdomain === ADMIN_SUBDOMAIN) return null;

	return subdomain;
}