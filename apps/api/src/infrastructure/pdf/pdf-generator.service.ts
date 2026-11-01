import { browserService } from "./browser.service";
import { renderReportCardHtml, renderReportCardsHtml, ReportCardTemplateData, ReportCardTemplateName, REPORT_CARD_TEMPLATES } from "./report-card.html";

export class PdfGeneratorService {
    /** `allowedImageHosts`: the only hosts the page may load images from (our own storage); everything else is blocked while printing. */
    async generateReportCardPdf(templateName: string, data: ReportCardTemplateData, allowedImageHosts: string[] = []): Promise<Buffer> {
        return browserService.renderHtmlToPdf(this.html(templateName, data), allowedImageHosts);
    }

    /** Many cards in one PDF (one page break after each). Longer time allowed: a class is a big document. */
    async generateReportCardsPdf(templateName: string, list: ReportCardTemplateData[], allowedImageHosts: string[] = []): Promise<Buffer> {
        return browserService.renderHtmlToPdf(this.htmlMany(templateName, list), allowedImageHosts, 120000);
    }

    htmlMany(templateName: string, list: ReportCardTemplateData[]): string {
        const name = (REPORT_CARD_TEMPLATES as readonly string[]).includes(templateName) ? (templateName as ReportCardTemplateName) : "classic";
        return renderReportCardsHtml(name, list);
    }

    html(templateName: string, data: ReportCardTemplateData): string {
        const name = (REPORT_CARD_TEMPLATES as readonly string[]).includes(templateName) ? (templateName as ReportCardTemplateName) : "classic";
        return renderReportCardHtml(name, data);
    }
}
