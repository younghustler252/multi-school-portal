import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../../../../packages/contracts/src";
import { UploadLetterheadUseCase } from "../../src/modules/school-settings/usecases/upload-letterhead.usecase";
import { checkBrandingImage, BRANDING_IMAGE_MAX_BYTES, LETTERHEAD_IMAGE_MAX_BYTES } from "../../src/modules/school-settings/domain/branding-image";

const MB = 1024 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], JPG = [0xff, 0xd8, 0xff, 0xe0], WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const file = (head: number[], size = 64) => { const b = Buffer.alloc(size); Buffer.from(head).copy(b); return b; };

function build() {
    const calls = { upload: [] as any[], upsert: [] as any[], audit: [] as any[] };
    const uc = new UploadLetterheadUseCase({
        storageService: { upload: async (o: any) => { calls.upload.push(o); return { url: "https://cdn.test/public/" + o.folder + "/x." + o.filename.split(".").pop(), path: "p", filename: "f", bucket: o.bucket }; } } as any,
        schoolSettingsRepository: { find: async () => ({ reportCardLetterheadUrl: "https://old/url.png" }), upsert: async (d: any) => { calls.upsert.push(d); return { id: "set1", ...d }; } } as any,
        schoolSettingsMapper: { toResponse: (s: any) => ({ id: s.id, reportCardLetterheadUrl: s.reportCardLetterheadUrl }) } as any,
        auditService: { log: async (a: any) => { calls.audit.push(a); } } as any,
    });
    return { uc, calls };
}
const bad = (code: string) => (e: any) => e.statusCode === 400 && e.code === code;

describe("letterhead upload", () => {
    it("the limit is 5 MB for a letterhead and still 2 MB for a stamp or signature", () => {
        assert.equal(LETTERHEAD_IMAGE_MAX_BYTES, 5 * MB); assert.equal(BRANDING_IMAGE_MAX_BYTES, 2 * MB);
        assert.equal(checkBrandingImage(file(PNG, 3 * MB)).ok, false);                                   // a stamp stays small
        assert.equal(checkBrandingImage(file(PNG, 3 * MB), LETTERHEAD_IMAGE_MAX_BYTES).ok, true);
        const e = checkBrandingImage(file(PNG, 2 * MB + 1)) as any;
        assert.equal(e.message, "The image must be 2 MB or smaller");                                  // existing message is unchanged
    });
    it("saves a PNG, JPEG or WebP: right folder, type and name from the bytes, URL stored as reportCardLetterheadUrl, audited with old and new", async () => {
        for (const [head, mime, ext] of [[PNG, "image/png", "png"], [JPG, "image/jpeg", "jpg"], [WEBP, "image/webp", "webp"]] as const) {
            const { uc, calls } = build();
            const out = await uc.execute("school1", "user1", { buffer: file([...head], 1024) });
            assert.equal(calls.upload[0].folder, "schools/school1/letterhead");
            assert.equal(calls.upload[0].mimetype, mime); assert.equal(calls.upload[0].filename, `letterhead.${ext}`);
            assert.deepEqual(Object.keys(calls.upsert[0]), ["reportCardLetterheadUrl"]);
            assert.equal(out.reportCardLetterheadUrl, calls.upsert[0].reportCardLetterheadUrl);
            assert.equal(calls.audit[0].action, "school_settings.letterhead_uploaded");
            assert.equal(calls.audit[0].oldValue.reportCardLetterheadUrl, "https://old/url.png");
        }
    });
    it("exactly 5 MB is accepted, one byte more is IMAGE_TOO_LARGE, and nothing is stored", async () => {
        const ok = build(); await ok.uc.execute("s", "u", { buffer: file(PNG, 5 * MB) }); assert.equal(ok.calls.upload.length, 1);
        const big = build();
        await assert.rejects(big.uc.execute("s", "u", { buffer: file(PNG, 5 * MB + 1) }), bad("IMAGE_TOO_LARGE"));
        assert.deepEqual([big.calls.upload.length, big.calls.upsert.length], [0, 0]);
    });
    it("an empty file, a GIF, a PDF, an SVG and an executable renamed .png are all refused by their bytes", async () => {
        const { uc, calls } = build();
        await assert.rejects(uc.execute("s", "u", { buffer: Buffer.alloc(0) }), bad("IMAGE_EMPTY"));
        for (const head of [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], [0x25, 0x50, 0x44, 0x46, 0x2d], Array.from(Buffer.from("<svg xmlns=")), [0x4d, 0x5a, 0x90, 0x00]]) {
            await assert.rejects(uc.execute("s", "u", { buffer: file(head, 200) }), bad("IMAGE_TYPE_NOT_ALLOWED"));
        }
        assert.equal(calls.upload.length, 0);
    });
});

describe("letterhead route (static check of the route file)", () => {
    const src = readFileSync("src/modules/school-settings/routes/school-settings.routes.ts", "utf8");
    const route = src.split("\n").find(l => l.includes('router.post("/letterhead"')) ?? "";
    it("permission, then the plan feature, then the file is read, then the tenant context is restored", () => {
        const order = ['guard("school_settings.manage")', 'requireFeature("report_cards.letterhead")', "letterheadUpload", "reestablishTenantContext", "uploadLetterhead"].map(t => route.indexOf(t));
        assert.ok(order.every(i => i >= 0), route);
        assert.deepEqual([...order].sort((a, b) => a - b), order);
    });
    it("reads the field named letterhead with a 5 MB limit and turns an oversize file into a 400", () => {
        assert.match(src, /single\("letterhead"\)/);
        assert.match(src, /fileSize:\s*LETTERHEAD_IMAGE_MAX_BYTES/);
        assert.match(src, /LIMIT_FILE_SIZE[^\n]*IMAGE_TOO_LARGE/);
    });
    it("stamp and signature routes are untouched (still the 2 MB multer)", () => {
        assert.match(src, /const upload = multer\(\{[^}]*fileSize:\s*BRANDING_IMAGE_MAX_BYTES/);
        assert.match(src, /router\.post\("\/stamp"[^\n]*upload\.single\("stamp"\)/);
        assert.match(src, /router\.post\("\/signature"[^\n]*upload\.single\("signature"\)/);
    });
    it("shared contract constants match the API", () => {
        assert.equal(C.LETTERHEAD_MAX_BYTES, LETTERHEAD_IMAGE_MAX_BYTES); assert.equal(C.LETTERHEAD_FIELD, "letterhead");
        assert.deepEqual([...C.LETTERHEAD_ALLOWED_TYPES].sort(), ["image/jpeg", "image/png", "image/webp"]);
    });
});
