/*
| PLATFORM SETTINGS: the logo is uploaded (never typed in) and can be cleared; the legal links are https only.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UpdatePlatformSettingsDto } from "../../src/modules/platform-settings/dtos/platform-settings.dto";
import { PlatformSettingsMapper } from "../../src/modules/platform-settings/mappers/platform-settings.mapper";
import { UploadPlatformLogoUseCase, RemovePlatformLogoUseCase, platformLogoPathOf } from "../../src/modules/platform-settings/usecases/platform-logo.usecases";
import { isHttpsUrl, isSafeHttpUrl } from "../../src/shared/utils/safe-url";
import { env } from "../../src/config/env";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64)]);
const bucket = () => env.supabase.publicBucket;
const urlFor = (path: string) => `https://abc.supabase.co/storage/v1/object/public/${bucket()}/${path}`;

const parse = (body: unknown) => UpdatePlatformSettingsDto.safeParse(body);

describe("platform settings: legal links (termsUrl / privacyPolicyUrl)", () => {
    it("accept a plain https link", () => {
        const r = parse({ termsUrl: "https://example.com/terms", privacyPolicyUrl: "https://example.com/privacy?x=1" });
        assert.ok(r.success); assert.equal(r.data.termsUrl, "https://example.com/terms");
    });
    it("refuse anything that is not https: javascript:, data:, http:, ftp:, and bare text", () => {
        for (const bad of ["javascript:alert(1)", "data:text/html;base64,PGgxPg==", "http://example.com/terms", "ftp://example.com/x", "example.com/terms", "https://", "not a url"]) {
            assert.equal(parse({ termsUrl: bad }).success, false, bad);
            assert.equal(parse({ privacyPolicyUrl: bad }).success, false, bad);
        }
    });
    it("refuse a link with a login inside it, and one that is too long", () => {
        assert.equal(parse({ termsUrl: "https://user:pass@example.com/t" }).success, false);
        assert.equal(parse({ termsUrl: "https://example.com/" + "a".repeat(2100) }).success, false);
    });
    it("null or empty text clears a link; leaving it out leaves it alone", () => {
        const a = parse({ termsUrl: null }); assert.ok(a.success); assert.equal(a.data.termsUrl, null);
        const b = parse({ termsUrl: "   " }); assert.ok(b.success); assert.equal(b.data.termsUrl, null);
        const c = parse({ platformName: "SchoolOS" }); assert.ok(c.success); assert.equal("termsUrl" in c.data, false);
    });
    it("spaces around a good link are trimmed", () => {
        const r = parse({ privacyPolicyUrl: "  https://example.com/p  " }); assert.ok(r.success); assert.equal(r.data.privacyPolicyUrl, "https://example.com/p");
    });
});

describe("platform settings: the logo can no longer be typed in", () => {
    it("a logoUrl in the update body is refused with a clear message", () => {
        for (const v of ["https://evil.example.com/x.png", "javascript:alert(1)", null, ""]) {
            const r = parse({ logoUrl: v });
            assert.equal(r.success, false, String(v));
            assert.match(JSON.stringify(r.error?.issues), /POST \/platform\/settings\/logo/);
        }
    });
    it("other settings still validate as before", () => {
        assert.ok(parse({ platformName: "SchoolOS", supportEmail: "help@example.com", defaultTrialDays: 14, maintenanceMode: false }).success);
        assert.equal(parse({ supportEmail: "nope" }).success, false);
        assert.equal(parse({ defaultTrialDays: 999 }).success, false);
    });
});

describe("platform settings: stored links are checked again on the way out", () => {
    const m = new PlatformSettingsMapper();
    const raw = (o: any) => ({ id: "1", platformName: "P", supportEmail: "a@b.c", subscriptionGracePeriodDays: 7, reminderDaysBeforeExpiry: 3, defaultTrialDays: 14, allowNewRegistrations: true, maintenanceMode: false, createdAt: new Date(), updatedAt: new Date(), ...o });
    it("an unsafe value saved earlier is hidden, not shown", () => {
        const r = m.toDomain(raw({ logoUrl: "javascript:alert(1)", termsUrl: "http://example.com/t", privacyPolicyUrl: "data:text/html,x" }));
        assert.equal(r.logoUrl, null); assert.equal(r.termsUrl, null); assert.equal(r.privacyPolicyUrl, null);
    });
    it("safe values pass through; http storage links still show for a local setup", () => {
        const r = m.toDomain(raw({ logoUrl: "http://localhost:54321/storage/v1/object/public/b/platform/logos/x.png", termsUrl: "https://example.com/t" }));
        assert.equal(r.logoUrl, "http://localhost:54321/storage/v1/object/public/b/platform/logos/x.png"); assert.equal(r.termsUrl, "https://example.com/t");
    });
    it("helpers", () => {
        assert.ok(isHttpsUrl("https://a.co")); assert.ok(!isHttpsUrl("http://a.co")); assert.ok(isSafeHttpUrl("http://a.co")); assert.ok(!isSafeHttpUrl("javascript:1"));
    });
});

describe("platform logo: where the old file is looked for", () => {
    it("only a file in platform/logos inside our public bucket counts", () => {
        assert.equal(platformLogoPathOf(urlFor("platform/logos/a.png")), "platform/logos/a.png");
        assert.equal(platformLogoPathOf(urlFor("schools/s1/logos/a.png")), null, "a school's file is never touched");
        assert.equal(platformLogoPathOf(urlFor("platform/logos/../../secrets/x")), null);
        assert.equal(platformLogoPathOf("https://evil.example.com/platform/logos/a.png"), null, "not our bucket");
        assert.equal(platformLogoPathOf(null), null);
    });
});

/* the use cases, with a pretend database, storage and audit */
function build(initialLogo: string | null = null, opts: { deleteFails?: boolean } = {}) {
    let logoUrl = initialLogo;
    const calls = { uploads: [] as any[], deletes: [] as string[], audits: [] as any[] };
    const mapper = new PlatformSettingsMapper();
    const row = () => mapper.toDomain({ id: "ps1", platformName: "P", supportEmail: "a@b.c", logoUrl, subscriptionGracePeriodDays: 7, reminderDaysBeforeExpiry: 3, defaultTrialDays: 14, allowNewRegistrations: true, maintenanceMode: false, createdAt: new Date(), updatedAt: new Date() });
    const d: any = {
        platformSettingsMapper: mapper,
        platformSettingsRepository: { find: async () => row(), setLogo: async (u: string | null) => { logoUrl = u; return row(); } },
        storageService: {
            upload: async (o: any) => { calls.uploads.push(o); return { url: urlFor(`${o.folder}/new-uuid.${o.filename.split(".").pop()}`), path: `${o.folder}/new-uuid`, filename: "x", bucket: o.bucket }; },
            delete: async (p: string) => { calls.deletes.push(p); if (opts.deleteFails) throw new Error("storage down"); },
        },
        auditService: { log: async (p: any) => { calls.audits.push(p); } },
    };
    return { d, calls, current: () => logoUrl };
}

describe("platform logo: upload", () => {
    it("saves a PNG or JPEG into platform/logos of the public bucket and stores the link we got back", async () => {
        for (const file of [PNG, JPEG]) {
            const { d, calls, current } = build();
            const r = await new UploadPlatformLogoUseCase(d).execute("u1", { buffer: file });
            assert.equal(calls.uploads.length, 1);
            assert.equal(calls.uploads[0].folder, "platform/logos"); assert.equal(calls.uploads[0].bucket, bucket());
            assert.equal(r.logoUrl, current()); assert.match(String(current()), /platform\/logos\//);
        }
    });
    it("refuses SVG, PDF, plain text, an empty file and anything over 2 MB, and saves nothing", async () => {
        for (const file of [SVG, PDF, Buffer.from("hello world, definitely not an image"), Buffer.alloc(0), Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])]) {
            const { d, calls, current } = build(urlFor("platform/logos/keep.png"));
            await assert.rejects(new UploadPlatformLogoUseCase(d).execute("u1", { buffer: file }), (e: any) => e.statusCode === 400 && e.code === "INVALID_IMAGE");
            assert.equal(calls.uploads.length, 0); assert.equal(current(), urlFor("platform/logos/keep.png")); assert.equal(calls.deletes.length, 0);
        }
    });
    it("replaces the old logo: the old file is removed, but only from our own folder", async () => {
        const a = build(urlFor("platform/logos/old.png"));
        await new UploadPlatformLogoUseCase(a.d).execute("u1", { buffer: PNG });
        assert.deepEqual(a.calls.deletes, ["platform/logos/old.png"]);
        const b = build("https://elsewhere.example.com/logo.png");   // an older, typed-in link: nothing of ours to delete
        await new UploadPlatformLogoUseCase(b.d).execute("u1", { buffer: PNG });
        assert.deepEqual(b.calls.deletes, []);
    });
    it("a failed clean-up of the old file never fails the upload", async () => {
        const { d, current } = build(urlFor("platform/logos/old.png"), { deleteFails: true });
        const r = await new UploadPlatformLogoUseCase(d).execute("u1", { buffer: PNG });
        assert.equal(r.logoUrl, current());
    });
    it("is recorded in the audit log against the platform (no school), by a super admin", async () => {
        const { d, calls } = build();
        await new UploadPlatformLogoUseCase(d).execute("u-admin", { buffer: PNG });
        assert.equal(calls.audits.length, 1);
        assert.equal(calls.audits[0].action, "platform.logo_changed"); assert.equal(calls.audits[0].userId, "u-admin"); assert.equal(calls.audits[0].schoolId, null);
    });
});

describe("platform logo: clear", () => {
    it("clears the stored link, removes the file, and audits it", async () => {
        const { d, calls, current } = build(urlFor("platform/logos/old.png"));
        const r = await new RemovePlatformLogoUseCase(d).execute("u1");
        assert.equal(r.logoUrl, null); assert.equal(current(), null);
        assert.deepEqual(calls.deletes, ["platform/logos/old.png"]);
        assert.equal(calls.audits[0].action, "platform.logo_removed");
    });
    it("clearing when there is no logo is harmless: nothing is deleted or audited", async () => {
        const { d, calls } = build(null);
        const r = await new RemovePlatformLogoUseCase(d).execute("u1");
        assert.equal(r.logoUrl, null); assert.equal(calls.deletes.length, 0); assert.equal(calls.audits.length, 0);
    });
    it("a failed file clean-up still clears the logo", async () => {
        const { d, current } = build(urlFor("platform/logos/old.png"), { deleteFails: true });
        await new RemovePlatformLogoUseCase(d).execute("u1");
        assert.equal(current(), null);
    });
});
