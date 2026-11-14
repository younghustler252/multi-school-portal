import { adminUrl, currentDeployment, schoolUrl } from "./deployment";
import { ROUTES } from "@/lib/routes";

/*
| Link to a school (or the admin host) by its subdomain label. Built from the deployment configuration
| (lib/deployment.ts), never from a hard-coded domain. A school with a custom domain should be linked by the `url` the API returns.
*/
export function buildSubdomainUrl(subdomain: string, path: string = ROUTES.school.dashboard) {
	const d = currentDeployment();
	return subdomain.toLowerCase() === d.adminSubdomain ? adminUrl(d, path) : schoolUrl(d, subdomain, path);
}
