import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as C from "../../../../packages/contracts/src";
import { UpdateAutomationDto } from "../../src/modules/automation/dtos/automation.dto";
import { SaveTemplateDto, PreviewTemplateDto } from "../../src/modules/message-templates/dtos/message-template.dto";
import { UpdateSchoolPreferencesDto } from "../../src/modules/school-settings/dtos/school-settings.dto";
import { ProvisioningQuery } from "../../src/modules/school/usecases/platform/school-provisioning.usecases";
import { GenerateDto, RemarksDto, PublishDto, UnpublishDto, ListCardsQuery, TemplateQuery, ClassPdfQuery } from "../../src/modules/report-cards/dtos/report-card.dto";
import { REPORT_CARD_TEMPLATES } from "../../src/infrastructure/pdf/report-card.html";
import { ImpersonateSchoolDto } from "../../src/modules/school/usecases/platform/impersonate-school.usecase";

/* The shared contract and the API's own DTO must accept and refuse exactly the same inputs. */
type Pair = { name: string; shared: { safeParse(v: unknown): { success: boolean } }; api: { safeParse(v: unknown): { success: boolean } }; samples: unknown[] };
const long = (n: number) => "x".repeat(n);
const UID = "8f6f8a50-1111-4c1d-9a5e-0f1c2d3e4f5a";

const pairs: Pair[] = [
    { name: "UpdateAutomation", shared: C.UpdateAutomationRequest, api: UpdateAutomationDto, samples: [
        {}, { enabled: true }, { enabled: "yes" }, { channels: [] }, { channels: ["SMS", "EMAIL"] }, { channels: ["PUSH"] }, { channels: ["IN_APP", "EMAIL", "SMS", "SMS"] },
        { params: { days: 3, on: true, text: "a" } }, { params: { text: long(201) } }, { params: { nested: {} } },
        { schedule: { type: "daily", time: "09:30" } }, { schedule: { type: "interval", minutes: 30 } }, { schedule: { type: "monthly" } }, { schedule: { type: "daily", extra: 1 } },
        { enabled: true, surprise: 1 },
    ] },
    { name: "SaveTemplate", shared: C.SaveTemplateRequest, api: SaveTemplateDto, samples: [
        {}, { body: "" }, { body: "Hi" }, { body: long(6000) }, { body: long(6001) }, { body: "x", subject: null }, { body: "x", subject: long(501) }, { body: "x", isActive: "no" }, { body: "x", other: 1 },
    ] },
    { name: "PreviewTemplate", shared: C.PreviewTemplateRequest, api: PreviewTemplateDto, samples: [
        {}, { body: "" }, { body: long(6001) }, { subject: null }, { subject: long(501) }, { other: 1 },
    ] },
    { name: "UpdatePreferences", shared: C.UpdatePreferencesRequest, api: UpdateSchoolPreferencesDto, samples: [
        {}, { values: {} }, { values: { "automation.enabled": true } }, { values: { "automation.enabled": null } }, { values: { a: {} } }, { values: { "": true } },
        { values: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, true])) }, { values: { a: true }, extra: 1 }, { "automation.enabled": true },
    ] },
    { name: "ProvisioningQuery", shared: C.ProvisioningQueryRequest, api: ProvisioningQuery, samples: [
        {}, { state: "failed" }, { state: "weird" }, { page: "0" }, { page: "2", limit: "100" }, { limit: "101" }, { search: "  alpha " }, { search: long(101) },
    ] },
    { name: "Impersonate", shared: C.ImpersonateRequest, api: ImpersonateSchoolDto, samples: [
        {}, { reason: "short" }, { reason: "Investigating a billing complaint" }, { reason: long(501) }, { reason: "Investigating a billing complaint", membershipId: "m1" }, { reason: "Investigating a billing complaint", membershipId: "" }, { reason: "Investigating a billing complaint", x: 1 },
    ] },
    { name: "GenerateReportCards", shared: C.GenerateReportCardsRequest, api: GenerateDto, samples: [
        {}, { classId: "x" }, { classId: UID }, { classId: UID, termId: UID }, { classId: UID, studentIds: [] }, { classId: UID, studentIds: [UID] }, { classId: UID, studentIds: Array(201).fill(UID) }, { classId: UID, extra: 1 },
    ] },
    { name: "ReportCardRemarks", shared: C.ReportCardRemarksRequest, api: RemarksDto, samples: [
        {}, { teacherRemark: "Good" }, { teacherRemark: null }, { principalRemark: "x".repeat(500) }, { principalRemark: "x".repeat(501) }, { teacherRemark: 5 }, { teacherRemark: "a", other: 1 },
    ] },
    { name: "PublishReportCards", shared: C.PublishReportCardsRequest, api: PublishDto, samples: [
        {}, { ids: [] }, { ids: [UID] }, { ids: ["x"] }, { ids: [UID], allowMissing: true }, { ids: [UID], allowMissing: "yes" }, { ids: Array(201).fill(UID) }, { ids: [UID], extra: 1 },
    ] },
    { name: "UnpublishReportCards", shared: C.UnpublishReportCardsRequest, api: UnpublishDto, samples: [
        {}, { ids: [UID] }, { ids: [UID], reason: "no" }, { ids: [UID], reason: "Wrong marks" }, { ids: [UID], reason: "x".repeat(501) }, { ids: [], reason: "Wrong marks" },
    ] },
    { name: "ListReportCardsQuery", shared: C.ListReportCardsQueryRequest, api: ListCardsQuery, samples: [
        {}, { page: "2" }, { page: "0" }, { limit: "100" }, { limit: "101" }, { status: "draft" }, { status: "generated" }, { termId: "x" }, { classId: UID, studentId: UID },
    ] },
    { name: "ReportCardTemplateQuery", shared: C.ReportCardTemplateQuery, api: TemplateQuery, samples: [
        {}, { template: "classic" }, { template: "modern" }, { template: "minimal" }, { template: "custom_letterhead" }, { template: "fancy" }, { template: 5 },
    ] },
    { name: "ClassPdfQuery", shared: C.ClassPdfQueryRequest, api: ClassPdfQuery, samples: [
        {}, { classId: UID }, { classId: "x" }, { classId: UID, termId: UID }, { classId: UID, template: "modern" }, { classId: UID, template: "fancy" },
        { classId: UID, include: "published" }, { classId: UID, include: "all" }, { classId: UID, include: "everything" }, { classId: UID, extra: 1 },
    ] },
];

test("the template keys offered to the web app are exactly the ones the renderer prints", () => {
    assert.deepEqual([...C.ReportCardTemplateKeys].sort(), [...REPORT_CARD_TEMPLATES].sort());
});

for (const p of pairs) {
    test(`contract parity: ${p.name}`, () => {
        const wrong = p.samples.filter(s => p.shared.safeParse(s).success !== p.api.safeParse(s).success);
        assert.deepEqual(wrong, [], `${p.name}: the shared contract and the API DTO disagree on these inputs`);
    });
}

const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : []; });

test("every shared error code is really produced by the API", () => {
    const source = walk(join(__dirname, "../../src")).map(f => readFileSync(f, "utf8")).join("\n");
    const unused = Object.values(C.ErrorCodes).filter(code => !source.includes(`"${code}"`) && !source.includes(`'${code}'`) && !new RegExp(`\\b${code}\\b`).test(source));
    assert.deepEqual(unused, []);
});

test("preference keys offered to the web app exist in the settings registry", () => {
    // each module declares its settings in <module>.settings.ts
    const registry = walk(join(__dirname, "../../src/modules")).filter(f => f.endsWith(".settings.ts")).map(f => readFileSync(f, "utf8")).join("\n");
    const missing = C.PreferenceKeys.filter(k => !registry.includes(`key: "${k}"`));
    assert.deepEqual(missing, []);
});
