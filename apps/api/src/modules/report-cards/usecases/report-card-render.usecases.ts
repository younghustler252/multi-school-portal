import type { Access } from "../../../foundation/access.service";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CARD_INCLUDE, snapshotOf } from "../repositories/card-table";
import type { ReportCardRenderer } from "../services/report-card-renderer.service";
import { cardsViewWhere, isFamily } from "../services/report-card-scope";
import { reportCardErrors } from "../domain/report-cards.errors";
import { isVisibleCard } from "../domain/report-card.policy";

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

/* THE PDF of one card (report_cards.view for that card, plus the plan feature report_cards.pdf, checked on the route). */
export class ReportCardPdfUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, schoolId: string, access: Access, template?: string): Promise<{ buffer: Buffer; filename: string }> {
        const { row, snap } = await loadCard(this.d, id, access);
        const buffer = await this.d.reportCardRenderer.cardPdf(schoolId, snap, { teacherRemark: row.teacherRemark, principalRemark: row.principalRemark }, !isVisibleCard(row.status), requestedFor(access, template));
        const safe = `${snap.student.firstName}-${snap.student.lastName}-${snap.term}`.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        return { buffer, filename: `${safe || "report-card"}.pdf` };
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
