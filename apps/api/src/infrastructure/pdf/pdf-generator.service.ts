import { browserService } from "./browser.service";
import { renderReportCardHtml, ReportCardTemplateData, ReportCardTemplateName, REPORT_CARD_TEMPLATES } from "./report-card.html";

export class PdfGeneratorService {
    /** `allowedImageHosts`: the only hosts the page may load images from (our own storage); everything else is blocked while printing. */
    async generateReportCardPdf(templateName: string, data: ReportCardTemplateData, allowedImageHosts: string[] = []): Promise<Buffer> {
        return browserService.renderHtmlToPdf(this.html(templateName, data), allowedImageHosts);
    }

    html(templateName: string, data: ReportCardTemplateData): string {
        const name = (REPORT_CARD_TEMPLATES as readonly string[]).includes(templateName) ? (templateName as ReportCardTemplateName) : "classic";
        return renderReportCardHtml(name, data);
    }
}
