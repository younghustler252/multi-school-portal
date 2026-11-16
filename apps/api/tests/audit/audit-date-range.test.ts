/*
| REM-078: audit endDate is INCLUSIVE of its calendar day (Lagos), startDate in the same zone; a reversed range is rejected.
| REM-071 / REM-062 / REM-065 / REM-081: small checks (source-level where the sandbox has no real zod; the DTO rules run in the project's own suite).
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditRangeStart, auditRangeEndExclusive } from "../../src/modules/audit/dtos/audit.dto";
import { ListSchoolAuditLogsUseCase } from "../../src/modules/audit/usecases/list-audit-logs.usecases";

const src = (p: string) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

describe("REM-078: audit date range", () => {
    it("a date-only end date includes the whole day in Lagos: an event at 23:30 that evening is inside, the next midnight is outside", () => {
        const end = auditRangeEndExclusive("2026-11-16") as { lt: Date };
        assert.equal(end.lt.toISOString(), "2026-11-16T23:00:00.000Z");                    // next midnight Lagos
        const evening = new Date("2026-11-16T22:30:00Z");                                  // 23:30 Lagos on the 16th
        assert.ok(evening < end.lt);
        assert.ok(!(new Date("2026-11-16T23:00:00Z") < end.lt));
    });
    it("control (the old rule): lte new Date('2026-11-16') drops almost the whole requested day", () => {
        assert.ok(!(new Date("2026-11-16T10:00:00Z") <= new Date("2026-11-16")));
    });
    it("a start date begins at Lagos midnight; a value with a time is used exactly", () => {
        assert.equal(auditRangeStart("2026-11-16").toISOString(), "2026-11-15T23:00:00.000Z");
        assert.equal(auditRangeStart("2026-11-16T08:15:00Z").toISOString(), "2026-11-16T08:15:00.000Z");
        assert.deepEqual(auditRangeEndExclusive("2026-11-16T08:15:00Z"), { lte: new Date("2026-11-16T08:15:00Z") });
    });
    it("the list use case passes the bounds to the query", async () => {
        let where: any; const repo: any = { async paginate(p: any) { where = p.where; return { data: [], meta: {} }; } };
        const uc: any = new ListSchoolAuditLogsUseCase({ auditRepository: repo, auditLogEnricherService: { async enrich(x: any) { return x; } } } as any);
        await uc.execute("sch", { page: 1, limit: 10, startDate: "2026-11-01", endDate: "2026-11-16" });
        assert.equal(where.createdAt.gte.toISOString(), "2026-10-31T23:00:00.000Z"); assert.equal(where.createdAt.lt.toISOString(), "2026-11-16T23:00:00.000Z"); assert.equal(where.createdAt.lte, undefined);
    });
    it("a reversed range is rejected by the query schema", () => {
        const s = src("src/modules/audit/dtos/audit.dto.ts");
        assert.match(s, /ListSchoolAuditQuery\s*=\s*z\.object\(base\)\.refine\(ordered/); assert.match(s, /ListPlatformAuditQuery = z\.object\([^\n]*\)\.refine\(ordered/);
    });
});

describe("small P2 fixes (source level)", () => {
    it("REM-071: overdue is parsed from the text true/false, not coerced", () => {
        const s = src("src/modules/subscriptions/dtos/subscription.dto.ts");
        assert.match(s, /overdue: z\.enum\(\["true", "false"\]\)\.transform\(v => v === "true"\)\.optional\(\)/); assert.doesNotMatch(s, /overdue: z\.coerce\.boolean/);
    });
    it("REM-062: a zero limit is not shown as granted", () => assert.match(src("src/modules/plans/services/plan-entitlement.service.ts"), /granted = !!r && \(r\.limitValue === null \|\| r\.limitValue > 0\)/));
    it("REM-065: plan prices stop at the 32-bit database limit", () => {
        const s = src("src/modules/plans/dtos/plan.dto.ts"); assert.match(s, /MAX_PLAN_KOBO = 2_147_483_647/); assert.doesNotMatch(s, /10_000_000_000/);
    });
    it("REM-081: platform links use the https-only schema; the logo cannot be typed in", () => {
        const s = src("src/modules/platform-settings/dtos/platform-settings.dto.ts");
        assert.match(s, /termsUrl:\s+nullableHttpsUrl\(\)/); assert.match(s, /privacyPolicyUrl:\s+nullableHttpsUrl\(\)/); assert.match(s, /logoUrl:\s+z\.never/);
    });
});

describe("REM-083/084: settings singletons", () => {
    it("migrations dedupe to the latest row and add a one-row unique index", () => {
        const a = src("prisma/migrations/20261116110000_platform_settings_singleton/migration.sql"), b = src("prisma/tenant-migrations/20261116110000_school_settings_singleton/migration.sql");
        for (const [s, t] of [[a, "PlatformSettings"], [b, "SchoolSettings"]] as const) { assert.match(s, new RegExp(`DELETE FROM "${t}"`)); assert.match(s, new RegExp(`CREATE UNIQUE INDEX "${t}_singleton" ON "${t}" \\(\\(true\\)\\)`)); }
    });
    it("the school repository recovers from losing the create race (P2002) by updating the winner's row, and rethrows other errors (source level: importing it needs the generated Prisma client)", () => {
        const r = src("src/modules/school-settings/repositories/school-settings.repository.impl.ts");
        assert.match(r, /try \{ return await this\.create\(data\); \}\s*catch \(e: any\) \{\s*if \(e\?\.code !== "P2002"\) throw e;\s*const winner = await this\.model\(\)\.findFirst\(\);\s*if \(!winner\) throw e;\s*return this\.update\(winner\.id, data\);/);
    });
    it("platform repository: same recovery in find()", () => assert.match(src("src/modules/platform-settings/repositories/platform-settings.repository.impl.ts"), /e\?\.code !== "P2002"[\s\S]*findFirst/));
});
