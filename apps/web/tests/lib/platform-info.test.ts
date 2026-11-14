import { describe, expect, it } from "vitest";
import type { CompanyConfig } from "@/config/company";
import { mergePlatformInfo } from "@/lib/platform-info";

const base: CompanyConfig = {
	name: "Default", fullName: "Default Full", tagline: "tag", description: "desc", logoUrl: "/logo.svg", logoLetter: "D", primaryColor: null,
	supportEmail: "old@example.com", salesEmail: "sales@example.com", website: "https://example.com",
	socials: { twitter: "t", linkedin: "l", instagram: "i" },
	legal: { companyName: "Default Ltd", privacyPolicyUrl: "/privacy", termsUrl: "/terms" },
};

describe("mergePlatformInfo", () => {
	it("keeps the defaults when the API has not answered or failed", () => {
		expect(mergePlatformInfo(base, null)).toBe(base);
		expect(mergePlatformInfo(base, undefined)).toBe(base);
	});

	it("takes name, logo, support contact and legal links from the API", () => {
		const out = mergePlatformInfo(base, {
			platformName: "Acme Schools", logoUrl: "https://cdn.example.com/l.png", supportEmail: "help@acme.test", supportPhone: "+234 800 000 0000",
			privacyPolicyUrl: "https://acme.test/privacy", termsUrl: "https://acme.test/terms",
		});
		expect(out.name).toBe("Acme Schools");
		expect(out.fullName).toBe("Acme Schools");
		expect(out.logoLetter).toBe("A");
		expect(out.logoUrl).toBe("https://cdn.example.com/l.png");
		expect(out.supportEmail).toBe("help@acme.test");
		expect(out.supportPhone).toBe("+234 800 000 0000");
		expect(out.legal.privacyPolicyUrl).toBe("https://acme.test/privacy");
		expect(out.legal.termsUrl).toBe("https://acme.test/terms");
	});

	it("shows the platform name, not a stale default entity, as the legal name", () => {
		expect(mergePlatformInfo(base, { platformName: "Acme Schools" }).legal.companyName).toBe("Acme Schools");
	});

	it("blank or null fields fall back to the defaults", () => {
		const out = mergePlatformInfo(base, { platformName: "  ", logoUrl: null, supportEmail: "", termsUrl: null });
		expect(out.name).toBe("Default");
		expect(out.logoUrl).toBe("/logo.svg");
		expect(out.supportEmail).toBe("old@example.com");
		expect(out.legal.termsUrl).toBe("/terms");
		expect(out.legal.companyName).toBe("Default Ltd");
	});

	it("leaves fields the API does not have untouched", () => {
		const out = mergePlatformInfo(base, { platformName: "Acme" });
		expect(out.tagline).toBe("tag");
		expect(out.socials).toEqual(base.socials);
		expect(out.website).toBe("https://example.com");
	});
});
