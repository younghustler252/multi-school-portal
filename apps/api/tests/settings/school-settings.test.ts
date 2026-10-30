/*
| SCHOOL SETTINGS (no database, no server): permission keys and grants, request validation, the image check,
| the plan feature check, preferences (strict write, audit, reset) and the route wiring.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { UpdateSchoolSettingsDto, UpdateSchoolPreferencesDto } from "../../src/modules/school-settings/dtos/school-settings.dto";
import { checkBrandingImage, sniffImageType, BRANDING_IMAGE_MAX_BYTES } from "../../src/modules/school-settings/domain/branding-image";
import { UpdateSchoolSettingsUseCase } from "../../src/modules/school-settings/usecases/update-school-settings.usecase";
import { GetSchoolPreferencesUseCase, UpdateSchoolPreferencesUseCase } from "../../src/modules/school-settings/usecases/school-preferences.usecases";
import { SchoolSettingsMapper } from "../../src/modules/school-settings/mappers/school-settings.mapper";
import { SchoolPreferencesService } from "../../src/modules/school-settings/services/school-preferences.service";

const code = (c: string) => (e: any) => e.code === c;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("school settings: permissions", () => {
    it("registry stays valid and has the two keys under their own module name", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
        const mine = PERMISSION_REGISTRY.filter(p => p.module === "school_settings");
        assert.deepEqual(mine.map(p => p.key).sort(), ["school_settings.manage", "school_settings.view"]);
        for (const p of mine) assert.deepEqual([...p.personas], ["STAFF"], "students and guardians can never hold them");
    });
    it("principal can view and manage; teacher, bursar, student and guardian cannot", () => {
        const granted = (k: string) => ROLE_TEMPLATES.find(r => r.key === k)!.permissions.map(p => p.key);
        assert.ok(granted("principal").includes("school_settings.manage"));
        for (const k of ["teacher", "bursar", "student", "guardian", "branch_principal"]) {
            assert.ok(!granted(k).some(x => x.startsWith("school_settings.")), `${k} must not hold school settings`);
        }
    });
});

describe("school settings: request validation", () => {
    it("accepts a normal update and refuses unknown fields and an empty body", () => {
        assert.ok(UpdateSchoolSettingsDto.safeParse({ primaryColor: "#1a1a2e", motto: "Hard work", website: "https://school.ng" }).success);
        assert.equal(UpdateSchoolSettingsDto.safeParse({}).success, false);
        assert.equal(UpdateSchoolSettingsDto.safeParse({ allowStudentLogin: true }).success, false, "not editable here");
        assert.equal(UpdateSchoolSettingsDto.safeParse({ teachingModel: "homeroom" }).success, false);
        assert.equal(UpdateSchoolSettingsDto.safeParse({ primaryColor: "red" }).success, false);
    });
    it("only web addresses: javascript: and data: links are refused", () => {
        for (const bad of ["javascript:alert(1)", "data:text/html,<script>1</script>", "ftp://x.ng/a"]) {
            assert.equal(UpdateSchoolSettingsDto.safeParse({ website: bad }).success, false, bad);
        }
        assert.equal(UpdateSchoolSettingsDto.safeParse({ reportCardLetterheadUrl: "http://x.ng/l.png" }).success, false, "letterhead must be https");
        assert.ok(UpdateSchoolSettingsDto.safeParse({ reportCardLetterheadUrl: "https://x.ng/l.png" }).success);
    });
    it("founding year cannot be in the future", () => {
        assert.equal(UpdateSchoolSettingsDto.safeParse({ foundedYear: new Date().getFullYear() + 1 }).success, false);
        assert.ok(UpdateSchoolSettingsDto.safeParse({ foundedYear: 1999 }).success);
    });
    it("preferences: 1 to 20 values, strict", () => {
        assert.ok(UpdateSchoolPreferencesDto.safeParse({ values: { "automation.enabled": null } }).success);
        assert.equal(UpdateSchoolPreferencesDto.safeParse({ values: {} }).success, false);
        assert.equal(UpdateSchoolPreferencesDto.safeParse({ values: { a: true }, extra: 1 }).success, false);
    });
});

describe("school settings: stamp and signature image check", () => {
    it("reads the real type from the first bytes", () => {
        assert.equal(sniffImageType(PNG)!.extension, "png");
        assert.equal(sniffImageType(JPG)!.extension, "jpg");
        assert.equal(sniffImageType(WEBP)!.extension, "webp");
    });
    it("refuses empty, oversized and non-image files whatever they are called", () => {
        assert.equal((checkBrandingImage(new Uint8Array()) as any).code, "IMAGE_EMPTY");
        const big = new Uint8Array(BRANDING_IMAGE_MAX_BYTES + 1); big.set(PNG);
        assert.equal((checkBrandingImage(big) as any).code, "IMAGE_TOO_LARGE");
        const html = new TextEncoder().encode("<script>alert(1)</script>");
        assert.equal((checkBrandingImage(html) as any).code, "IMAGE_TYPE_NOT_ALLOWED");
        const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>");
        assert.equal((checkBrandingImage(svg) as any).code, "IMAGE_TYPE_NOT_ALLOWED", "SVG can carry scripts");
        assert.equal(checkBrandingImage(PNG).ok, true);
    });
});

function settingsWorld(plan: { letterhead: boolean }) {
    let row: any = null;
    const audit: any[] = [];
    const repo: any = {
        async find() { return row; },
        // like the real repository: the saved row comes back as an entity (through the mapper)
        async upsert(data: any) { row = { id: "s1", reportCardTemplate: "classic", createdAt: new Date(), updatedAt: new Date(), ...row, ...data }; return new SchoolSettingsMapper().toDomain(row); },
    };
    const d: any = {
        schoolSettingsRepository: repo, schoolSettingsMapper: new SchoolSettingsMapper(),
        entitlementsService: { async checkFeature(_s: string, key: string) { return key === "report_cards.letterhead" && !plan.letterhead ? { allowed: false, reason: "not_granted" } : { allowed: true }; } },
        auditService: { async log(p: any) { audit.push(p); } },
    };
    return { audit, update: new UpdateSchoolSettingsUseCase(d), get row() { return row; } };
}

describe("school settings: update", () => {
    it("saves, audits what really changed, and stays quiet when nothing changed", async () => {
        const w = settingsWorld({ letterhead: false });
        const out = await w.update.execute({ motto: "Light" }, "sch", "u1");
        assert.equal(out.motto, "Light");
        assert.equal(w.audit.length, 1);
        assert.deepEqual(w.audit[0].newValue.changes, [{ field: "motto", from: null, to: "Light" }]);
        await w.update.execute({ motto: "Light" }, "sch", "u1");
        assert.equal(w.audit.length, 1, "no change, no audit entry");
    });
    it("the custom letterhead needs the plan feature; other templates do not", async () => {
        const w = settingsWorld({ letterhead: false });
        await assert.rejects(w.update.execute({ reportCardTemplate: "custom_letterhead" }, "sch", "u1"), code("FEATURE_NOT_AVAILABLE"));
        await assert.rejects(w.update.execute({ reportCardLetterheadUrl: "https://x.ng/l.png" }, "sch", "u1"), code("FEATURE_NOT_AVAILABLE"));
        assert.equal(w.row, null, "nothing saved");
        assert.equal((await w.update.execute({ reportCardTemplate: "modern" }, "sch", "u1")).reportCardTemplate, "modern");
        const paid = settingsWorld({ letterhead: true });
        const out = await paid.update.execute({ reportCardTemplate: "custom_letterhead" }, "sch", "u1");
        assert.equal(out.customReportCard, true, "derived from the template (the column does not exist)");
    });
});

function prefsWorld() {
    const rows: Record<string, unknown> = {};
    const audit: any[] = [];
    const repo: any = {
        async findOverrides(keys?: string[]) { return Object.fromEntries(Object.entries(rows).filter(([k]) => !keys || keys.includes(k))); },
        async set(k: string, v: unknown) { rows[k] = v; },
        async remove(k: string) { delete rows[k]; },
    };
    const d: any = { schoolSettingValueRepository: repo, auditService: { async log(p: any) { audit.push(p); } } };
    const o = { transaction: async <T>(fn: () => Promise<T>) => fn() };
    return { rows, audit, get: new GetSchoolPreferencesUseCase(d), update: new UpdateSchoolPreferencesUseCase(d, o), service: new SchoolPreferencesService(d) };
}

describe("school settings: preferences", () => {
    it("lists defaults, saves valid values, audits, and null resets", async () => {
        const w = prefsWorld();
        const first = (await w.get.execute()).settings.find(s => s.key === "notifications.sms_enabled")!;
        assert.equal(first.value, false); assert.equal(first.isOverridden, false);
        const r = await w.update.execute("sch", "u1", { values: { "notifications.sms_enabled": true } } as any);
        assert.deepEqual(r.changed, ["notifications.sms_enabled"]);
        assert.equal(w.audit.length, 1);
        assert.equal((await w.service.all())["notifications.sms_enabled"], true);
        assert.deepEqual((await w.update.execute("sch", "u1", { values: { "notifications.sms_enabled": true } } as any)).changed, []);
        assert.equal(w.audit.length, 1);
        await w.update.execute("sch", "u1", { values: { "notifications.sms_enabled": null } } as any);
        assert.equal("notifications.sms_enabled" in w.rows, false);
        assert.equal((await w.service.all())["notifications.sms_enabled"], false);
    });
    it("is all or nothing, refuses unknown keys, and never touches finance keys", async () => {
        const w = prefsWorld();
        await assert.rejects(w.update.execute("sch", "u1", { values: { "automation.enabled": false, "notifications.email_enabled": "no" } } as any), code("SETTING_INVALID"));
        assert.deepEqual(w.rows, {});
        await assert.rejects(w.update.execute("sch", "u1", { values: { "finance.grace_days": 5 } } as any), code("SETTING_UNKNOWN"));
        await assert.rejects(w.update.execute("sch", "u1", { values: { "made.up": 1 } } as any), code("SETTING_UNKNOWN"));
    });
});

describe("school settings: routes", () => {
    const src = readFileSync("src/modules/school-settings/routes/school-settings.routes.ts", "utf8");
    const code2 = src.split("\n").filter(l => !l.trim().startsWith("//") && !l.trim().startsWith("|")).join("\n");
    it("every route is behind a permission, none behind the old role guard", () => {
        const routes = [...code2.matchAll(/^router\.(get|put|post)\(/gm)];
        assert.equal(routes.length, 6);
        const lines = code2.split("\n").filter(l => /^router\.(get|put|post)\(/.test(l));
        for (const l of lines) assert.match(l, /\.\.\.guard\("school_settings\.(view|manage)"\)/, l);
        assert.ok(!/requireSchoolAdmin/.test(code2));
    });
    it("reads are view, writes are manage, and the permission runs before the upload is read", () => {
        assert.match(code2, /router\.get\("\/",\s*\.\.\.guard\("school_settings\.view"\)/);
        assert.match(code2, /router\.put\("\/",\s*\.\.\.guard\("school_settings\.manage"\)/);
        assert.match(code2, /router\.post\("\/stamp",\s*\.\.\.guard\("school_settings\.manage"\),\s*upload\.single/);
        assert.match(code2, /upload\.single\("signature"\),\s*reestablishTenantContext/);
    });
    it("is mounted, and its container is registered", () => {
        const idx = readFileSync("src/routes/index.ts", "utf8").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
        assert.match(idx, /router\.use\("\/school-settings",\s*schoolSettingRouter\)/);
        const cont = readFileSync("src/container/index.ts", "utf8").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
        assert.match(cont, /registerSchoolSettings,/);
    });
});
