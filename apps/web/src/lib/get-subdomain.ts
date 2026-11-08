import { classifyHost, currentDeployment, schoolSubdomainOf } from "./deployment";

// Thin wrappers kept for existing imports. The rules live in lib/deployment.ts and come from environment variables.

export function extractSubdomain(hostname: string): string | null {
	return schoolSubdomainOf(hostname, currentDeployment());
}

export function isAdminSubdomain(hostname: string): boolean {
	return classifyHost(hostname, currentDeployment()).kind === "admin";
}

/** A school reached through its own verified domain (no <subdomain>.<base> label). */
export function isCustomDomain(hostname: string): boolean {
	return classifyHost(hostname, currentDeployment()).kind === "custom";
}
