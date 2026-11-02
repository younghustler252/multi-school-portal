import type { Access } from "../../../foundation/access.service";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CARD_INCLUDE, snapshotOf } from "../repositories/card-table";
import type { ReportCardRenderer } from "../services/report-card-renderer.service";
import type { PdfCacheService } from "../services/pdf-cache.service";
import { loadClassPdfItems } from "../services/class-pdf-items";
import { cardsViewWhere, isFamily, mayViewClass } from "../services/report-card-scope";
import { reportCardErrors } from "../domain/report-cards.errors";
import { isVisibleCard } from "../domain/report-card.policy";
import type { ClassPdfQueryType } from "../dtos/report-card.dto";

interface Dependencies { reportCardsRepository: ReportCardsRepository; reportCardRenderer: ReportCardRenderer }

/*
| A class PDF can take long enough to render (a big class, a cold cache) that an HTTP/gateway timeout would cut the
| request off before it finishes — the cache write would still happen, but the caller gets a failure for a PDF that
| actually succeeded a moment later. So rendering a class PDF goes through a queue (`ClassPdfQueuePort`); the route
| only ever blocks for the cheap "is it already cached?" check. Lazily loaded, like `TicketStore`/`redisTicketStore`,
| so importing this file never opens a queue connection (tests inject a fake).
*/
export interface ClassPdfQueuePort {
    enqueue(jobId: string, job: { schoolId: string; tenantSchema: string; termId: string; classId: string; template?: string; include: "published" | "all" }): Promise<void>;
    /** "queued" covers both waiting and active (the caller doesn't need to tell those apart); "done" / "failed" are terminal. "unknown" = no such job (expired from the queue, or never existed). */
    status(jobId: string): Promise<"queued" | "done" | "failed" | "unknown">;
}

/** The real queue (BullMQ/Redis), loaded on first use. */
export function bullClassPdfQueue(): ClassPdfQueuePort {
    return {
        async enqueue(jobId, job) {
            const { enqueueClassPdf } = await import("../../../infrastructure/jobs/queues/class-pdf.queue");
            await enqueueClassPdf(jobId, job);
        },
        async status(jobId) {
            const { classPdfQueue } = await import("../../../infrastructure/jobs/queues/class-pdf.queue");
            const job = await classPdfQueue.getJob(jobId);
            if (!job) return "unknown";
            const state = await job.getState();
            if (state === "completed") return "done";
            if (state === "failed") return "failed";
            return "queued";
        },
    };
}

/** Families always get the school's own template; only staff may try another one. */
const requestedFor = (access: Access, template?: string): string | undefined => (isFamily(access) ? undefined : template);

async function loadCard(d: Dependencies, id: string, access: Access) {
    const row = await d.reportCardsRepository.cards.findFirst({ where: { AND: [{ id }, cardsViewWhere(access)] }, include: CARD_INCLUDE });
    if (!row) throw reportCardErrors.notFound();
    const snap = snapshotOf(row);
    if (!snap) throw reportCardErrors.noPdf();
    return { row, snap };
}

/*
| PREVIEW of one card as HTML (JSON { html, template }): the SAME markup the PDF is printed from, so the screen shows what will print.
| Show it in an <iframe srcdoc sandbox>. (An iframe cannot send the login header, so the page is returned as data, not as a URL.)
| Staff can add ?template= to try another template without saving anything. A card that is not published is marked DRAFT.
*/
export class ReportCardPreviewUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, schoolId: string, access: Access, template?: string) {
        const { row, snap } = await loadCard(this.d, id, access);
        const r = await this.d.reportCardRenderer.cardHtml(schoolId, snap, { teacherRemark: row.teacherRemark, principalRemark: row.principalRemark }, !isVisibleCard(row.status), requestedFor(access, template));
        return { template: r.template, fellBack: r.fellBack, html: this.d.reportCardRenderer.html(r.template, r.data) };
    }
}

/* THE PDF of one card (report_cards.view for that card, plus the plan feature report_cards.pdf, checked on the route). Cached by content hash. */
export class ReportCardPdfUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, schoolId: string, access: Access, template?: string): Promise<{ buffer: Buffer; filename: string; cached: boolean }> {
        const { row, snap } = await loadCard(this.d, id, access);
        const { buffer, cached } = await this.d.reportCardRenderer.cardPdf(
            schoolId, row.termId, row.id, snap, { teacherRemark: row.teacherRemark, principalRemark: row.principalRemark }, !isVisibleCard(row.status), requestedFor(access, template),
        );
        const safe = `${snap.student.firstName}-${snap.student.lastName}-${snap.term}`.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        return { buffer, filename: `${safe || "report-card"}.pdf`, cached };
    }
}

const safeFilename = (name: string): string => `${name.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "class"}-report-cards.pdf`;

type ClassPdfResult =
    | { status: "ready"; buffer: Buffer; filename: string; cardCount: number; cached: boolean }
    | { status: "queued"; jobId: string; filename: string; cardCount: number };

/*
| GET /report-cards/class-pdf: every card of a class, in one PDF, one page break after each.
| Staff only (mayViewClass: ALL, or the class teacher). `include=published` (default) only cards that are published/sent;
| `include=all` any card that has content yet, drafts included (each one watermarked DRAFT by the renderer).
| Cached by content hash: the whole document is rebuilt only when a card in it, or the branding, actually changed.
| A CACHE HIT answers with the PDF straight away. A MISS never renders inline (a big class could outrun an HTTP
| timeout): it enqueues a background job and answers 202 with a job id; GET .../class-pdf/status/:jobId polls it,
| and once "done" the SAME class-pdf request (now a cache hit) returns the PDF.
*/
export class ClassPdfUseCase {
    constructor(private readonly d: Dependencies & { classPdfQueue: ClassPdfQueuePort; pdfCacheService: PdfCacheService }) {}
    async execute(query: ClassPdfQueryType, schoolId: string, tenantSchema: string, access: Access): Promise<ClassPdfResult> {
        if (isFamily(access)) throw reportCardErrors.notAllowed("download a whole class's report cards");
        const repo = this.d.reportCardsRepository;
        const termId = query.termId ?? (await repo.currentTerm())?.id;
        if (!termId) throw reportCardErrors.termNotFound();
        const cls = await repo.classOf(query.classId);
        if (!cls) throw reportCardErrors.classNotFound();
        if (!mayViewClass(access, cls.classTeacherId)) throw reportCardErrors.cannotSee();

        const { items } = await loadClassPdfItems(repo, termId, query.classId, query.include);
        const filename = safeFilename(cls.name);

        const { hash, folder } = await this.d.reportCardRenderer.classPdfKey(schoolId, termId, query.classId, items, query.template);
        const cached = await this.d.pdfCacheService.peek(folder, hash);
        if (cached) return { status: "ready", buffer: cached, filename, cardCount: items.length, cached: true };

        await this.d.classPdfQueue.enqueue(hash, { schoolId, tenantSchema, termId, classId: query.classId, template: query.template, include: query.include });
        return { status: "queued", jobId: hash, filename, cardCount: items.length };
    }
}

/** GET /report-cards/class-pdf/status/:jobId — poll a class PDF job. Once "done", repeat the original GET /report-cards/class-pdf request: it will now be a cache hit. */
export class ClassPdfStatusUseCase {
    constructor(private readonly d: { classPdfQueue: ClassPdfQueuePort }) {}
    async execute(jobId: string): Promise<{ status: "queued" | "done" | "failed" | "unknown" }> {
        return { status: await this.d.classPdfQueue.status(jobId) };
    }
}

/**
 * The background job itself (run by the worker, inside the school's tenant context — never called from a route).
 * No access check: the route already checked access before enqueueing; the worker is trusted system code re-doing
 * the (cheap) gather and the (expensive) render + cache write.
 */
export class ClassPdfJobRunner {
    constructor(private readonly d: { reportCardsRepository: ReportCardsRepository; reportCardRenderer: ReportCardRenderer }) {}
    async run(schoolId: string, termId: string, classId: string, include: "published" | "all", template?: string): Promise<void> {
        const { items } = await loadClassPdfItems(this.d.reportCardsRepository, termId, classId, include);
        await this.d.reportCardRenderer.classPdf(schoolId, termId, classId, items, template);
    }
}

/* GET /report-cards/templates: the picker (staff only). */
export class ListTemplatesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, access: Access) {
        if (isFamily(access)) throw reportCardErrors.notAllowed("see the report card templates");
        return this.d.reportCardRenderer.templates(schoolId);
    }
}

/* GET /report-cards/template-preview?template=: a sample report card in the school's own name, logo and colours (staff only). */
export class TemplatePreviewUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, access: Access, template?: string) {
        if (isFamily(access)) throw reportCardErrors.notAllowed("preview report card templates");
        const r = await this.d.reportCardRenderer.sample(schoolId, template);
        return { template: r.template, fellBack: r.fellBack, html: this.d.reportCardRenderer.html(r.template, r.data) };
    }
}
