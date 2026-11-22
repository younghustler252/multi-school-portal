import { cn } from "@/lib/utils";

/*
| Part-to-whole in one horizontal bar, with a legend that carries every label and value.
|   - Segments are separated by a 2px gap of the surface colour, never touching.
|   - Colour is never the only signal: the legend names and counts every segment, and the bar has a text equivalent.
|   - Zero-value segments are left out of the bar (they stay in the legend), non-zero ones keep a minimum width so a
|     small share is still visible.
|   - With a total of 0 the bar is an empty track; the legend still lists the labels.
*/

export type SegmentTone = "primary" | "warning" | "danger" | "info" | "neutral";

const FILL: Record<SegmentTone, string> = {
	primary: "bg-primary",
	warning: "bg-data-warning",
	danger: "bg-destructive",
	info: "bg-info",
	neutral: "bg-data-neutral",
};

export interface Segment {
	key: string;
	label: string;
	value: number;
	tone: SegmentTone;
}

interface SegmentedBarProps {
	segments: Segment[];
	/** Turns a value into text for the legend and the screen-reader label (e.g. formatNaira). Default: the number. */
	formatValue?: (value: number) => string;
	/** What the bar shows, for screen readers: "Attendance today". */
	label: string;
	className?: string;
}

export function SegmentedBar({ segments, formatValue = String, label, className }: SegmentedBarProps) {
	const total = segments.reduce((sum, s) => sum + s.value, 0);
	const shown = segments.filter((s) => s.value > 0);
	const summary = segments.map((s) => `${s.label} ${formatValue(s.value)}`).join(", ");

	return (
		<div className={cn("space-y-3", className)}>
			<div
				role="img"
				aria-label={`${label}: ${summary}`}
				className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
			>
				{shown.map((s) => (
					<span
						key={s.key}
						className={cn("h-full min-w-1 first:rounded-l-full last:rounded-r-full", FILL[s.tone])}
						style={{ flexGrow: s.value, flexBasis: 0 }}
					/>
				))}
			</div>

			<ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
				{segments.map((s) => (
					<li key={s.key} className="flex min-w-0 items-center gap-2">
						<span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-sm", FILL[s.tone])} />
						<span className="truncate text-muted-foreground">{s.label}</span>
						<span className="tabular ml-auto font-semibold">
							{formatValue(s.value)}
						</span>
					</li>
				))}
			</ul>
			{total === 0 && <span className="sr-only">No values yet.</span>}
		</div>
	);
}
