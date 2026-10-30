import companyData from "./company.json";

export interface CompanyConfig {
	name: string;
	fullName: string;
	tagline: string;
	description: string;
	logoUrl: string | null; // null = use fallback letter avatar
	logoLetter: string;
	primaryColor: string | null; // null = use default --primary from globals.css
	supportEmail: string;
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

// SchoolOS's own default branding — used on marketing site, super-admin console,
// and as the fallback for any school that hasn't set custom branding (or isn't on a plan that allows it).
export const DEFAULT_COMPANY: CompanyConfig = {
	...companyData,
	logoUrl: "/logo.svg", // real logo file in /public
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