import { ReportCardStatus, ReportCardTemplate } from "../types/report-card.types";

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