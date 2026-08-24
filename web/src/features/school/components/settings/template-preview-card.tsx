import { cn } from "@/lib/utils";
import { ReportCardTemplate } from "../../types/school-settings.types";
import { REPORT_CARD_TEMPLATE_LABELS } from "@/features/report-cards/constants/report-card-labels";

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

export function TemplatePreviewCard({ template, selected, locked, onSelect }: TemplatePreviewCardProps) {
	return (
		<button
			type="button"
			onClick={onSelect}
			disabled={locked}
			className={cn(
				"rounded-xl border p-4 text-left transition-colors",
				selected ? "border-primary bg-primary/5" : "border-border bg-card",
				locked && "cursor-not-allowed opacity-50"
			)}
		>
			{/* Simple visual placeholder representing the layout shape — not a real render */}
			<div className="mb-3 aspect-[3/4] rounded-md border border-dashed border-border bg-muted/40 p-2">
				<div className="h-2 w-3/4 rounded-sm bg-muted-foreground/20" />
				<div className="mt-2 space-y-1">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="h-1.5 rounded-sm bg-muted-foreground/10" />
					))}
				</div>
			</div>
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">{REPORT_CARD_TEMPLATE_LABELS[template]}</span>
				{locked && <span className="text-[10px] text-muted-foreground">Pro plan</span>}
			</div>
			<p className="mt-1 text-xs text-muted-foreground">{TEMPLATE_DESCRIPTIONS[template]}</p>
		</button>
	);
}