import { cn } from "@/lib/utils";
import { ReportCardTemplate } from "../../types/school-settings.types";
import {
	REPORT_CARD_TEMPLATE_LABELS,
	getTemplatePreviewUrl,
} from "@/features/report-cards/constants/report-card-labels";

const TEMPLATE_DESCRIPTIONS: Record<ReportCardTemplate, string> = {
	classic: "Traditional layout with a formal header and grade table.",
	modern: "Clean, colorful design with a card-based subject breakdown.",
	minimal: "Simple, text-focused layout — fastest to print.",
	custom_letterhead: "Your own letterhead image with results overlaid below.",
};

interface TemplatePreviewCardProps {
	template: ReportCardTemplate;
	selected: boolean;
	locked?: boolean;
	onSelect: () => void;
}

export function TemplatePreviewCard({
	template,
	selected,
	locked,
	onSelect,
}: TemplatePreviewCardProps) {
	return (
		<button
			type="button"
			onClick={onSelect}
			disabled={locked}
			className={cn(
				"rounded-xl border p-4 text-left transition-colors",
				selected ? "border-primary bg-primary/5" : "border-border bg-card",
				locked && "cursor-not-allowed opacity-50",
			)}
		>
			{/* Real report card preview */}
			<div className="mb-3 aspect-[3/4] overflow-hidden rounded-md border border-border">
				{getTemplatePreviewUrl(template) && (
					<img
						src={getTemplatePreviewUrl(template)}
						alt={`${REPORT_CARD_TEMPLATE_LABELS[template]} preview`}
						className="size-full object-cover"
					/>
				)}
			</div>

			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">
					{REPORT_CARD_TEMPLATE_LABELS[template]}
				</span>

				{locked && (
					<span className="text-[10px] text-muted-foreground">
						Pro plan
					</span>
				)}
			</div>

			<p className="mt-1 text-xs text-muted-foreground">
				{TEMPLATE_DESCRIPTIONS[template]}
			</p>
		</button>
	);
}