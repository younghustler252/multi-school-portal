import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../../src/infrastructure/middleware/cors-origin";
import { PlatformSettingsMapper } from "../../src/modules/platform-settings/mappers/platform-settings.mapper";

describe("CORS origins follow the platform's own domain", () => {
    const ok = (o: string | undefined, base = "schoolos.ng", env = "production") => isAllowedOrigin(o, base, env);
    it("allows the platform domain and its subdomains over https", () => {
        for (const o of ["https://schoolos.ng", "https://greenfield.schoolos.ng", "https://admin.schoolos.ng", "https://a.b.schoolos.ng"]) assert.equal(ok(o), true, o);
    });
    it("refuses look-alikes, other schemes and other domains", () => {
        for (const o of ["http://greenfield.schoolos.ng", "https://schoolos.ng.evil.com", "https://notschoolos.ng", "https://evil.com/?x=greenfield.schoolos.ng", "https://yourapp.com", "https://greenfield.yourapp.com"])
            assert.equal(ok(o), false, o);
    });
    it("lets requests with no origin through, allows everything in development, and refuses all when no domain is set", () => {
        assert.equal(ok(undefined), true);
        assert.equal(ok("https://anything.example", "schoolos.ng", "development"), true);
        assert.equal(isAllowedOrigin("https://schoolos.ng", "", "production"), false);
    });
    it("a dot in the domain is a dot, not 'any character'", () => assert.equal(ok("https://schoolosXng"), false));
});

describe("the public platform settings response never carries anything private", () => {
    it("only a fixed list of branding, support, legal and status fields can come out, whatever the database row holds", () => {
        const row: any = { id: "p1", platformName: "SchoolOS", supportEmail: "a@b.c", subscriptionGracePeriodDays: 7, reminderDaysBeforeExpiry: 7, defaultTrialDays: 0, allowNewRegistrations: true, maintenanceMode: false,
            createdAt: new Date(), updatedAt: new Date(), updatedById: "u1", smtpPassword: "secret", paystackSecretKey: "sk_live", apiKey: "k" };
        const out = new PlatformSettingsMapper().toResponse(new PlatformSettingsMapper().toDomain(row));
        for (const k of ["updatedById", "smtpPassword", "paystackSecretKey", "apiKey"]) assert.equal(k in out, false, k);
        assert.deepEqual(Object.keys(out).sort(), ["allowNewRegistrations", "announcementBanner", "createdAt", "defaultTrialDays", "id", "logoUrl", "maintenanceMessage", "maintenanceMode", "platformName", "privacyPolicyUrl", "reminderDaysBeforeExpiry", "subscriptionGracePeriodDays", "supportEmail", "supportPhone", "termsUrl", "updatedAt"]);
    });
});
