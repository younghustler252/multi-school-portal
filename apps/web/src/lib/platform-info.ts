import type { CompanyConfig } from "@/config/company";

/*
| Platform branding comes from the platform API (GET /platform/settings, public: no sign-in, no school needed).
| This file only MERGES what the API returned over the built-in defaults, so the UI always has something to show while the
| request is running or if it fails. Pure, so it is tested without a network.
|
| What the API provides today: platformName, supportEmail, supportPhone, logoUrl, termsUrl, privacyPolicyUrl.
| What it does not provide (so these stay at the defaults in config/company.json until the backend adds them):
| tagline, description, social links, sales email, and a legal company name.
| For the legal company name we show the platform name when the API supplies one, rather than a stale default entity.
*/

export interface PlatformSettingsSubset {
	platformName?: string | null;
	supportEmail?: string | null;
	supportPhone?: string | null;
	logoUrl?: string | null;
	termsUrl?: string | null;
	privacyPolicyUrl?: string | null;
}

const text = (v: string | null | undefined): string | null => {
	const t = typeof v === "string" ? v.trim() : "";
	return t === "" ? null : t;
};

export function mergePlatformInfo(base: CompanyConfig, s: PlatformSettingsSubset | null | undefined): CompanyConfig {
	if (!s) return base;
	const name = text(s.platformName);
	return {
		...base,
		...(name ? { name, fullName: name, logoLetter: name.charAt(0).toUpperCase() } : {}),
		logoUrl: text(s.logoUrl) ?? base.logoUrl,
		supportEmail: text(s.supportEmail) ?? base.supportEmail,
		supportPhone: text(s.supportPhone) ?? base.supportPhone ?? null,
		legal: {
			...base.legal,
			...(name ? { companyName: name } : {}),
			privacyPolicyUrl: text(s.privacyPolicyUrl) ?? base.legal.privacyPolicyUrl,
			termsUrl: text(s.termsUrl) ?? base.legal.termsUrl,
		},
	};
}
