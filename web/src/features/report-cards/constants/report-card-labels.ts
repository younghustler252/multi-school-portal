import { ReportCardStatus, ReportCardTemplate } from "../types/report-card.types";
import { getApiBaseUrl } from "@/lib/api/get-api-base-url";

export function getTemplatePreviewUrl(
    template: ReportCardTemplate,
): string {
    if (template === "custom_letterhead") return "";

    return `${getApiBaseUrl()}/report-cards/template-previews/${template}.png`;
}

export const REPORT_CARD_STATUS_LABELS: Record<ReportCardStatus, string> = {
	draft: "Draft",
	generated: "Generated",
	published: "Published",
	sent: "Sent",
};

export const REPORT_CARD_STATUS_VARIANT: Record<ReportCardStatus, "default" | "secondary" | "outline"> = {
	draft: "outline",
	generated: "secondary",
	published: "default",
	sent: "default",
};

export const REPORT_CARD_TEMPLATE_LABELS: Record<ReportCardTemplate, string> = {
	classic: "Classic",
	modern: "Modern",
	minimal: "Minimal",
	custom_letterhead: "Custom Letterhead",
};

export const REPORT_CARD_TEMPLATE_PREVIEWS: Record<ReportCardTemplate, string> = {
	classic: "/report-cards/template-previews/classic.png",
	modern: "/report-cards/template-previews/modern.png",
	minimal: "/report-cards/template-previews/minimal.png",
	custom_letterhead: "",
};