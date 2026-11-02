import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReportCardHtml, REPORT_CARD_TEMPLATES, esc, safeImage, safeColor, ordinal } from "../../src/infrastructure/pdf/report-card.html";
import { ReportCardRenderer, sampleData, templateDataFor } from "../../src/modules/report-cards/services/report-card-renderer.service";
import { PdfCacheService, PdfCacheStore } from "../../src/modules/report-cards/services/pdf-cache.service";
import { ReportCardPreviewUseCase, ReportCardPdfUseCase, ListTemplatesUseCase, TemplatePreviewUseCase, ClassPdfUseCase, ClassPdfStatusUseCase, ClassPdfJobRunner, ClassPdfQueuePort } from "../../src/modules/report-cards/usecases/report-card-render.usecases";
import { GenerateReportCardsUseCase } from "../../src/modules/report-cards/usecases/generate-report-cards.usecase";
import { admin, access, fakeRepo, worldWith, pub, auditLog } from "./helpers";

const ctx = { school: { name: "Alpha", logoUrl: "https://files.example.test/logo.png", motto: "Be good", address: "1 Road" }, branding: { primaryColor: "#1f6f43", secondaryColor: null, stampUrl: null, signatureUrl: null }, letterhead: undefined };

test("every piece of text is escaped: a hostile name, remark or school name cannot add markup", () => {
    const evil = `<img src=x onerror=alert(1)>"'&`;
    const d = { ...sampleData(ctx), school: { ...ctx.school, name: evil, motto: evil, address: evil }, className: evil, termName: evil, sessionName: evil, teacherRemark: evil, principalRemark: evil, missingSubjects: [evil] };
    d.student = { ...d.student, firstName: evil, admissionNumber: evil };
    d.subjects = [{ ...d.subjects[0], subjectName: evil, remark: evil, grade: evil }];
    for (const t of REPORT_CARD_TEMPLATES) {
        const html = renderReportCardHtml(t, { ...d, letterhead: { imageUrl: "https://files.example.test/lh.png", contentTopMm: 50, contentBottomMm: 30 } });
        assert.equal(html.includes("<img src=x"), false, t);
        assert.equal(/onerror\s*=\s*alert/.test(html.replace(/&lt;img src=x onerror=alert\(1\)&gt;/g, "")), false, t);
        assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;"), t);
    }
});

test("images must be https; colours must be hex", () => {
    assert.equal(safeImage("https://a.test/x.png"), "https://a.test/x.png");
    for (const bad of ["http://a.test/x.png", "file:///etc/passwd", "javascript:alert(1)", "data:image/png;base64,AAAA", "//a.test/x.png", "not a url", "", null, undefined]) assert.equal(safeImage(bad as any), null, String(bad));
    assert.equal(safeColor("#1f6f43", "#000"), "#1f6f43");
    for (const bad of ["red", "#12", "url(x)", "#fff;}</style><script>", null]) assert.equal(safeColor(bad as any, "#000"), "#000");
    const html = renderReportCardHtml("classic", { ...sampleData(ctx), school: { ...ctx.school, logoUrl: "file:///etc/passwd" }, branding: { ...ctx.branding, primaryColor: "red;}</style><script>x</script>", signatureUrl: "http://a.test/s.png" } });
    assert.equal(html.includes("file:///"), false); assert.equal(html.includes("<script>"), false); assert.equal(html.includes("http://a.test"), false);
});

test("ordinals", () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
    assert.equal(ordinal(null), "-"); assert.equal(esc(null), "");
});

test("every theme prints the same data: parts, totals, grade, positions, overall, attendance, missing subjects, remarks", () => {
    const d = { ...sampleData(ctx), missingSubjects: ["Music"], draft: false };
    for (const t of REPORT_CARD_TEMPLATES) {
        const html = renderReportCardHtml(t, d);
        for (const must of ["Mathematics", "Tolu Adeyemi", "ADM/2026/014", "JSS 2", "4th of 32", "CA", "Exam", "/40", "/60", "644", "80.5", "Very good", "57 of 60 days present", "3 absent", "Not yet available: Music", "hardworking", "Well done", "First Term"]) assert.ok(html.includes(must), `${t} is missing "${must}"`);
        assert.equal(html.includes("DRAFT"), false);
    }
});

test("a draft is marked; a failed subject is highlighted; an absent part shows ABS; no attendance means no attendance line", () => {
    const d = sampleData(ctx);
    d.subjects[0] = { ...d.subjects[0], isPass: false, parts: [{ position: 1, name: "CA", maxScore: 40, score: 10, absent: false }, { position: 2, name: "Exam", maxScore: 60, score: 0, absent: true }] };
    d.attendance = null;
    const html = renderReportCardHtml("classic", { ...d, draft: true });
    assert.ok(html.includes("DRAFT")); assert.ok(html.includes(">ABS<")); assert.ok(html.includes('class="tot fail"')); assert.equal(html.includes("days present"), false);
});

test("the letterhead theme uses the school's image and offsets; an unknown template name falls back to classic in the generator", () => {
    const html = renderReportCardHtml("custom_letterhead", { ...sampleData(ctx), letterhead: { imageUrl: "https://files.example.test/lh.png", contentTopMm: 55, contentBottomMm: 35 } });
    assert.ok(html.includes("https://files.example.test/lh.png")); assert.ok(html.includes("--top:55mm")); assert.ok(html.includes("--bottom:35mm"));
});

/** An in-memory queue (no real Redis/BullMQ), so the enqueue/poll contract is observable in tests. Jobs resolve "done" the moment the test calls `run`. */
function fakeClassPdfQueue(): ClassPdfQueuePort & { jobs: Array<{ jobId: string; job: any }>; states: Map<string, "queued" | "done" | "failed"> } {
    const jobs: Array<{ jobId: string; job: any }> = [];
    const states = new Map<string, "queued" | "done" | "failed">();
    return {
        jobs, states,
        async enqueue(jobId, job) { jobs.push({ jobId, job }); if (!states.has(jobId)) states.set(jobId, "queued"); },
        async status(jobId) { return states.get(jobId) ?? "unknown"; },
    };
}

/** An in-memory PdfCacheStore (no real storage), so cache behaviour is observable in tests. */
function fakeCacheStore(): PdfCacheStore & { files: Map<string, Buffer> } {
    const files = new Map<string, Buffer>();
    return {
        files,
        async get(path) { return files.get(path) ?? null; },
        async put(path, data) { files.set(path, data); },
        async listFolder(folder) { return [...files.keys()].filter(k => k.startsWith(`${folder}/`)).map(k => k.slice(folder.length + 1)); },
        async deleteMany(paths) { for (const p of paths) files.delete(p); },
    };
}

// ── use cases ────────────────────────────────────────────────────────────
const NOW = new Date("2026-10-05T09:00:00Z");
async function setup(opts: { settings?: any; plan?: boolean } = {}) {
    const world = worldWith([{ id: "m", name: "Maths", sheet: pub("sm") }], { sm: { a: [30, 50], b: [20, 40], c: [10, 20] } });
    const { repo, rows, builder } = fakeRepo(world); const a = auditLog();
    await new GenerateReportCardsUseCase({ reportCardsRepository: repo, reportCardBuilder: builder, auditService: a.svc }).execute({ classId: "c1" }, "sch", admin(), { userId: "u1" }, NOW);
    const pdfCalls: any[] = [];
    const settings = { reportCardTemplate: "classic", primaryColor: "#1f6f43", ...opts.settings };
    const cacheStore = fakeCacheStore();
    const pdfCacheService = new PdfCacheService(cacheStore);
    const renderer = new ReportCardRenderer({
        schoolRepository: { findById: async () => ({ name: "Alpha", logoUrl: "https://files.example.test/logo.png" }) } as any,
        schoolSettingsRepository: { find: async () => settings } as any,
        pdfGeneratorService: {
            html: (t: any, d: any) => renderReportCardHtml(t, d),
            generateReportCardPdf: async (t: string, d: any, hosts: string[]) => { pdfCalls.push({ t, d, hosts }); return Buffer.from("%PDF-fake"); },
            generateReportCardsPdf: async (t: string, list: any[], hosts: string[]) => { pdfCalls.push({ t, list, hosts }); return Buffer.from("%PDF-class-fake"); },
        } as any,
        entitlementsService: { checkFeature: async () => ({ allowed: opts.plan !== false }) },
        allowedImageHosts: ["files.example.test"],
        pdfCacheService,
    });
    const deps = { reportCardsRepository: repo, reportCardRenderer: renderer };
    const classPdfQueue = fakeClassPdfQueue();
    return {
        rows, pdfCalls, cacheStore, classPdfQueue,
        preview: new ReportCardPreviewUseCase(deps), pdf: new ReportCardPdfUseCase(deps),
        list: new ListTemplatesUseCase(deps), sample: new TemplatePreviewUseCase(deps),
        classPdf: new ClassPdfUseCase({ ...deps, classPdfQueue, pdfCacheService }),
        classPdfStatus: new ClassPdfStatusUseCase({ classPdfQueue }),
        classPdfJobRunner: new ClassPdfJobRunner(deps),
    };
}
const family = () => access({ persona: "GUARDIAN", me: "g1", can: ["report_cards.view"], scopes: { "report_cards.view": "OWN" } });

test("preview returns the page as data; a draft is marked, a published card is not", async () => {
    const s = await setup();
    const draft = await s.preview.execute(s.rows[0].id, "sch", admin());
    assert.equal(draft.template, "classic"); assert.ok(draft.html.includes("DRAFT")); assert.ok(draft.html.includes("A Pupil") || draft.html.includes("Pupil"));
    s.rows[0].status = "published";
    assert.equal((await s.preview.execute(s.rows[0].id, "sch", admin())).html.includes("DRAFT"), false);
});

test("staff can try another template without saving; families always get the school's own", async () => {
    const s = await setup({ settings: { reportCardTemplate: "minimal" } });
    s.rows[0].status = "published";
    assert.equal((await s.preview.execute(s.rows[0].id, "sch", admin())).template, "minimal");
    assert.equal((await s.preview.execute(s.rows[0].id, "sch", admin(), "modern")).template, "modern");
    assert.equal((await s.preview.execute(s.rows[0].id, "sch", family(), "modern")).template, "minimal");
});

test("the letterhead template: refused when asked for without an image or plan; quietly classic when it is only the saved default", async () => {
    const noImage = await setup({ settings: { reportCardTemplate: "classic", reportCardLetterheadUrl: null } });
    await assert.rejects(noImage.preview.execute(noImage.rows[0].id, "sch", admin(), "custom_letterhead"), (e: any) => e.code === "REPORT_CARD_TEMPLATE_UNAVAILABLE" && /Upload your letterhead/.test(e.message));
    const noPlan = await setup({ settings: { reportCardTemplate: "classic", reportCardLetterheadUrl: "https://files.example.test/lh.png" }, plan: false });
    await assert.rejects(noPlan.preview.execute(noPlan.rows[0].id, "sch", admin(), "custom_letterhead"), /plan does not include/);
    const downgraded = await setup({ settings: { reportCardTemplate: "custom_letterhead", reportCardLetterheadUrl: "https://files.example.test/lh.png" }, plan: false });
    const r = await downgraded.preview.execute(downgraded.rows[0].id, "sch", admin());
    assert.equal(r.template, "classic"); assert.equal(r.fellBack, true);
    const ok = await setup({ settings: { reportCardTemplate: "classic", reportCardLetterheadUrl: "https://files.example.test/lh.png" } });
    assert.equal((await ok.preview.execute(ok.rows[0].id, "sch", admin(), "custom_letterhead")).template, "custom_letterhead");
});

test("the picker lists every template, which one is saved, and why the letterhead is not available", async () => {
    const s = await setup({ settings: { reportCardTemplate: "modern", reportCardLetterheadUrl: null } });
    const t = await s.list.execute("sch", admin());
    assert.deepEqual(t.map(x => x.key), ["classic", "modern", "minimal", "custom_letterhead"]);
    assert.equal(t.find(x => x.current)!.key, "modern");
    const lh = t.find(x => x.key === "custom_letterhead")!; assert.equal(lh.available, false); assert.match(lh.unavailableReason!, /Upload your letterhead/);
    assert.ok(t.filter(x => x.key !== "custom_letterhead").every(x => x.available && x.unavailableReason === null));
    await assert.rejects(s.list.execute("sch", family()), /not allowed/);
});

test("sample preview uses the school's own name and colours and is for staff only", async () => {
    const s = await setup();
    const r = await s.sample.execute("sch", admin(), "modern");
    assert.equal(r.template, "modern"); assert.ok(r.html.includes("Alpha")); assert.ok(r.html.includes("#1f6f43")); assert.ok(r.html.includes("Tolu Adeyemi"));
    await assert.rejects(s.sample.execute("sch", family()), /not allowed/);
});

test("the PDF is drawn from the snapshot with the chosen template, only our own storage host may be loaded, and the file name is safe", async () => {
    const s = await setup();
    s.rows[0].status = "published"; (s.rows[0].snapshot as any).student.firstName = "Ann/../<b>";
    const r = await s.pdf.execute(s.rows[0].id, "sch", admin(), "minimal");
    assert.equal(r.buffer.toString(), "%PDF-fake"); assert.match(r.filename, /^[A-Za-z0-9-]+\.pdf$/);
    assert.equal(r.cached, false);
    assert.equal(s.pdfCalls[0].t, "minimal"); assert.deepEqual(s.pdfCalls[0].hosts, ["files.example.test"]);
    assert.equal(s.pdfCalls[0].d.draft, false); assert.equal(s.pdfCalls[0].d.subjects[0].subjectName, "Maths");
    await assert.rejects(s.pdf.execute("ghost", "sch", admin()), /not found/i);
});

test("single PDF: a second identical request is served from cache, a changed remark renders again and evicts the old file", async () => {
    const s = await setup();
    s.rows[0].status = "published";
    const first = await s.pdf.execute(s.rows[0].id, "sch", admin(), "minimal");
    assert.equal(first.cached, false); assert.equal(s.pdfCalls.length, 1);

    const second = await s.pdf.execute(s.rows[0].id, "sch", admin(), "minimal");
    assert.equal(second.cached, true); assert.equal(s.pdfCalls.length, 1, "no re-render on a cache hit");
    assert.equal(second.buffer.toString(), first.buffer.toString());

    const folder = `schools/sch/report-cards/${s.rows[0].termId}/single/${s.rows[0].id}`;
    assert.equal([...s.cacheStore.files.keys()].filter(k => k.startsWith(folder)).length, 1);

    s.rows[0].teacherRemark = "Changed remark";
    const third = await s.pdf.execute(s.rows[0].id, "sch", admin(), "minimal");
    assert.equal(third.cached, false); assert.equal(s.pdfCalls.length, 2, "a changed remark re-renders");
    assert.equal([...s.cacheStore.files.keys()].filter(k => k.startsWith(folder)).length, 1, "the old cached file was evicted");
});

test("class PDF: a miss queues a background job, not an inline render; staff only, drafts excluded by default", async () => {
    const s = await setup();
    await assert.rejects(s.classPdf.execute({ classId: "c1", include: "published" } as any, "sch", "schema1", family()), /not allowed/);

    // nothing published yet -> nothing to print
    await assert.rejects(s.classPdf.execute({ classId: "c1", include: "published" } as any, "sch", "schema1", admin()), /nothing/i);

    s.rows[0].status = "published";
    const r = await s.classPdf.execute({ classId: "c1", include: "published" } as any, "sch", "schema1", admin());
    assert.equal(r.status, "queued"); assert.equal(s.pdfCalls.length, 0, "a miss never renders inline");
    if (r.status !== "queued") throw new Error("unreachable");
    assert.equal(r.cardCount, 1); assert.match(r.filename, /report-cards\.pdf$/);
    assert.equal(s.classPdfQueue.jobs.length, 1);
    assert.deepEqual(s.classPdfQueue.jobs[0].job, { schoolId: "sch", tenantSchema: "schema1", termId: "term1", classId: "c1", template: undefined, include: "published" });
    assert.equal((await s.classPdfStatus.execute(r.jobId)).status, "queued");

    // the background worker runs the job: gathers fresh and renders+caches
    await s.classPdfJobRunner.run("sch", "term1", "c1", "published");
    assert.equal(s.pdfCalls.length, 1);
    s.classPdfQueue.states.set(r.jobId, "done");
    assert.equal((await s.classPdfStatus.execute(r.jobId)).status, "done");

    // the SAME request, repeated, is now a cache hit and returns the PDF straight away (no second job)
    const again = await s.classPdf.execute({ classId: "c1", include: "published" } as any, "sch", "schema1", admin());
    assert.equal(again.status, "ready");
    if (again.status !== "ready") throw new Error("unreachable");
    assert.equal(again.buffer.toString(), "%PDF-class-fake"); assert.equal(again.cached, true);
    assert.equal(s.classPdfQueue.jobs.length, 1, "no second job for an already-cached request");

    assert.equal((await s.classPdfStatus.execute("0000000000000000")).status, "unknown");
});

test("class PDF: include=all also prints drafts, watermarked", async () => {
    const s = await setup();
    const r = await s.classPdf.execute({ classId: "c1", include: "all" } as any, "sch", "schema1", admin());
    assert.equal(r.status, "queued");
    await s.classPdfJobRunner.run("sch", "term1", "c1", "all");
    const dataList = s.pdfCalls[0].list;
    assert.equal(dataList.length, 3, "all 3 students' draft cards are included with include=all");
    assert.ok(dataList.every((d: any) => d.draft === true), "every unpublished card prints with the DRAFT watermark in a whole-class PDF too");
});

test("the print data comes only from the frozen snapshot (a changed sheet cannot change it)", async () => {
    const s = await setup();
    const snap: any = s.rows[0].snapshot;
    const data = templateDataFor(snap, { teacherRemark: "t", principalRemark: null }, ctx, true);
    assert.equal(data.totalScore, snap.result.totalScore); assert.equal(data.position, snap.result.position); assert.equal(data.draft, true);
    assert.deepEqual(data.subjects.map(x => x.subjectName), snap.result.subjects.map((x: any) => x.subjectName));
});
