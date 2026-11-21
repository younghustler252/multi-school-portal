import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UploadLetterheadUseCase } from "../../src/modules/school-settings/usecases/upload-letterhead.usecase";
import { checkBrandingImage, BRANDING_IMAGE_MAX_BYTES, LETTERHEAD_IMAGE_MAX_BYTES } from "../../src/modules/school-settings/domain/branding-image";

const PNG = (n = 100) => { const b = Buffer.alloc(n); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); return b; };

function world(allowed = true) {
    const uploads: any[] = [], saved: any[] = [], audits: any[] = [];
    const uc = new UploadLetterheadUseCase({
        entitlementsService: { checkFeature: async (_s: string, k: string) => ({ allowed: allowed && k === "report_cards.letterhead" }) } as any,
        storageService: { upload: async (x: any) => { uploads.push(x); return { url: "https://cdn/" + x.folder + "/" + x.filename }; } } as any,
        schoolSettingsRepository: { upsert: async (d: any) => { saved.push(d); return { id: "set1", ...d }; } } as any,
        schoolSettingsMapper: { toResponse: (e: any) => ({ reportCardLetterheadUrl: e.reportCardLetterheadUrl }) } as any,
        auditService: { log: async (a: any) => { audits.push(a); } } as any,
    });
    return { uc, uploads, saved, audits };
}

describe("report card letterhead upload", () => {
    it("stores a real picture under the school's folder, sets only the letterhead URL and audits it", async () => {
        const w = world();
        const r = await w.uc.execute("sch1", "u1", { buffer: PNG() });
        assert.equal(w.uploads[0].folder, "schools/sch1/letterhead");
        assert.equal(w.uploads[0].filename, "letterhead.png"); assert.equal(w.uploads[0].mimetype, "image/png");
        assert.deepEqual(w.saved, [{ reportCardLetterheadUrl: "https://cdn/schools/sch1/letterhead/letterhead.png" }]);   // the template is not switched here
        assert.equal(r.reportCardLetterheadUrl, "https://cdn/schools/sch1/letterhead/letterhead.png");
        assert.equal(w.audits[0].action, "school_settings.letterhead_uploaded");
    });
    it("needs the plan feature, checked before anything is stored", async () => {
        const w = world(false);
        await assert.rejects(w.uc.execute("sch1", "u1", { buffer: PNG() }), /letterhead|not available|plan/i);
        assert.equal(w.uploads.length, 0); assert.equal(w.saved.length, 0);
    });
    it("rejects non-pictures and empty files, whatever the browser said", async () => {
        const w = world();
        await assert.rejects(w.uc.execute("sch1", "u1", { buffer: Buffer.from("<script>alert(1)</script>") }), /PNG, JPEG or WebP/);
        await assert.rejects(w.uc.execute("sch1", "u1", { buffer: Buffer.alloc(0) }), /empty/i);
        assert.equal(w.uploads.length, 0);
    });
    it("allows up to 5 MB for a letterhead while stamps stay at 2 MB", async () => {
        assert.equal(checkBrandingImage(PNG(3 * 1024 * 1024)).ok, false);
        assert.equal(checkBrandingImage(PNG(3 * 1024 * 1024), LETTERHEAD_IMAGE_MAX_BYTES).ok, true);
        const big = checkBrandingImage(PNG(LETTERHEAD_IMAGE_MAX_BYTES + 1), LETTERHEAD_IMAGE_MAX_BYTES);
        assert.equal(big.ok, false); assert.match((big as any).message, /5 MB/);
        assert.equal(BRANDING_IMAGE_MAX_BYTES, 2 * 1024 * 1024);
        const w = world();
        await assert.rejects(w.uc.execute("sch1", "u1", { buffer: PNG(LETTERHEAD_IMAGE_MAX_BYTES + 1) }), /5 MB/);
    });
    it("the route is manage-only, reads the 'letterhead' field with the 5 MB limit and re-establishes the tenant", () => {
        const r = readFileSync(join(__dirname, "../../src/modules/school-settings/routes/school-settings.routes.ts"), "utf8");
        assert.match(r, /router\.post\("\/letterhead", \.\.\.guard\("school_settings\.manage"\), uploadLetterhead\.single\("letterhead"\), reestablishTenantContext/);
        assert.match(r, /uploadLetterhead = multer\([^\n]*LETTERHEAD_IMAGE_MAX_BYTES/);
    });
});
