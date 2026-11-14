import companyData from "./company.json";
import { currentDeployment, platformUrl } from "@/lib/deployment";

export interface CompanyConfig {
	name: string;
	fullName: string;
	tagline: string;
	description: string;
	logoUrl: string | null; // null = use fallback letter avatar
	logoLetter: string;
	primaryColor: string | null; // null = use default --primary from globals.css
	supportEmail: string;
	supportPhone?: string | null;
	salesEmail: string;
	website: string;
	socials: {
		twitter: string;
		linkedin: string;
		instagram: string;
	};
	legal: {
		companyName: string;
		privacyPolicyUrl: string;
		termsUrl: string;
	};
}

// Built-in DEFAULTS only. The platform API (GET /platform/settings, via usePlatformInfo) overrides name, logo, support
// contact and legal links at runtime; these values show while it loads or if it cannot be reached.
// Used on marketing site, super-admin console,
// and as the fallback for any school that hasn't set custom branding (or isn't on a plan that allows it).
export const DEFAULT_COMPANY: CompanyConfig = {
	...companyData,
	logoUrl: "/logo.svg", // real logo file in /public
	website: platformUrl(currentDeployment(), "").replace(/\/$/, ""), // from NEXT_PUBLIC_BASE_DOMAIN, never typed here
	primaryColor: null,
};

// Static import for now — components can use this directly while backend isn't ready.
export const COMPANY = DEFAULT_COMPANY;

// Future seam: once `school` module API is live, this fetches the CURRENT
// tenant's branding override (if their plan includes white-labeling) and
// falls back to DEFAULT_COMPANY for any field not customized.
// No component code changes when we wire this up — same CompanyConfig shape.
export async function getBrandingConfig(): Promise<CompanyConfig> {
	// TODO: once school.api.ts exists —
	// const school = await schoolApi.getBranding();
	// return { ...DEFAULT_COMPANY, ...school.brandingOverrides };
	return DEFAULT_COMPANY;
}