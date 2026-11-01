import type { Access } from "../../../foundation/access.service";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CARD_INCLUDE, snapshotOf } from "../repositories/card-table";
import type { ReportCardRenderer } from "../services/report-card-renderer.service";
import { cardsViewWhere, isFamily, mayViewClass } from "../services/report-card-scope";
import { reportCardErrors } from "../domain/report-cards.errors";
import { isVisibleCard } from "../domain/report-card.policy";
import type { ClassPdfQueryType } from "../dtos/report-card.dto";

interface Dependencies { reportCardsRepository: ReportCardsRepository; reportCardRenderer: ReportCardRenderer }

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

/*
| GET /report-cards/class-pdf: every card of a class, in one PDF, one page break after each.
| Staff only (mayViewClass: ALL, or the class teacher). `include=published` (default) only cards that are published/sent;
| `include=all` any card that has content yet, drafts included (each one watermarked DRAFT by the renderer).
| Cached by content hash: the whole document is rebuilt only when a card in it, or the branding, actually changed.
*/
export class ClassPdfUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(query: ClassPdfQueryType, schoolId: string, access: Access): Promise<{ buffer: Buffer; filename: string; cardCount: number; cached: boolean }> {
        if (isFamily(access)) throw reportCardErrors.notAllowed("download a whole class's report cards");
        const repo = this.d.reportCardsRepository;
        const termId = query.termId ?? (await repo.currentTerm())?.id;
        if (!termId) throw reportCardErrors.termNotFound();
        const cls = await repo.classOf(query.classId);
        if (!cls) throw reportCardErrors.classNotFound();
        if (!mayViewClass(access, cls.classTeacherId)) throw reportCardErrors.cannotSee();

        const list = await repo.studentsOnList(query.classId, termId);
        const cards = await repo.cardsOfStudents(termId, list.map(e => e.studentId));
        const withContent = cards
            .filter(c => query.include === "all" ? snapshotOf(c) !== null : isVisibleCard(c.status))
            .filter(c => snapshotOf(c) !== null)
            .sort((a, b) => `${a.student.lastName}${a.student.firstName}`.localeCompare(`${b.student.lastName}${b.student.firstName}`));
        if (withContent.length === 0) throw reportCardErrors.nothingPublished();

        const items = withContent.map(c => ({
            snap: snapshotOf(c)!,
            remarks: { teacherRemark: c.teacherRemark, principalRemark: c.principalRemark },
        }));
        const { buffer, cached } = await this.d.reportCardRenderer.classPdf(schoolId, termId, query.classId, items, query.template);
        const safe = cls.name.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        return { buffer, filename: `${safe || "class"}-report-cards.pdf`, cardCount: items.length, cached };
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
