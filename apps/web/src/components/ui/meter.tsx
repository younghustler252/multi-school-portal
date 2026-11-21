import { cn } from "@/lib/utils";

type MeterTone = "primary" | "warning" | "danger";

const FILL: Record<MeterTone, string> = {
	primary: "bg-primary",
	warning: "bg-warning",
	danger: "bg-destructive",
};

interface MeterProps {
	/** 0-100. */
	percent: number;
	/** Names what is measured, for screen readers. */
	label: string;
	/** Spoken value, e.g. "120 of 150 students". */
	valueText?: string;
	tone?: MeterTone;
	className?: string;
}

/** One value against a limit. Pair it with visible text (the number and what it is); the bar alone is not the message. */
export function Meter({ percent, label, valueText, tone = "primary", className }: MeterProps) {
	const value = Math.max(0, Math.min(100, Math.round(percent)));
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={value}
			aria-valuetext={valueText}
			className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
		>
			<div className={cn("h-full rounded-full transition-[width] duration-300 ease-standard", FILL[tone])} style={{ width: `${value}%` }} />
		</div>
	);
}
