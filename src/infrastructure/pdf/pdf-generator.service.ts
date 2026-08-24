import { browserService } from "./browser.service";
import { renderClassicTemplate, ReportCardTemplateData } from "./templates/classic.template";
import { renderModernTemplate } from "./templates/modern.template";
import { renderMinimalTemplate } from "./templates/minimal.template";
import { renderCustomLetterheadTemplate } from "./templates/custom-letterhead.template";

export class PdfGeneratorService {
    async generateReportCardPdf(
        templateName: string,
        data: ReportCardTemplateData,
    ): Promise<Buffer> {
        const html = this.render(templateName, data);
        return browserService.renderHtmlToPdf(html);
    }

    private render(templateName: string, data: ReportCardTemplateData): string {
        switch (templateName) {
            case "modern":            return renderModernTemplate(data);
            case "minimal":           return renderMinimalTemplate(data);
            case "custom_letterhead": return renderCustomLetterheadTemplate(data);
            case "classic":
            default:
                return renderClassicTemplate(data);
        }
    }
}