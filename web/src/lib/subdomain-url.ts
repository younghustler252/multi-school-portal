export function buildSubdomainUrl(subdomain: string, path: string = "/school-admin/dashboard") {
	const isLocal = typeof window !== "undefined" && window.location.hostname.endsWith(".localhost");
	return isLocal
		? `http://${subdomain}.localhost:3000${path}`
		: `https://${subdomain}.schoolos.app${path}`;
}