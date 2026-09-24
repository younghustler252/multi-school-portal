import { Check } from "lucide-react";

const STEPS = ["School details", "Admin account", "Confirm"];

export function RegisterStepper({ step }: { step: number }) {
	return (
		<div>
			{/* Mobile: dots + current label */}
			<div className="flex items-center gap-2 sm:hidden">
				{STEPS.map((_, i) => {
					const n = i + 1;
					return (
						<div
							key={n}
							className={`h-1.5 flex-1 rounded-full transition-colors ${
								step >= n ? "bg-primary" : "bg-muted"
							}`}
						/>
					);
				})}
			</div>
			<p className="mt-2 text-sm font-medium sm:hidden">
				Step {step} of {STEPS.length}: {STEPS[step - 1]}
			</p>

			{/* Desktop: full stepper */}
			<div className="hidden items-center gap-3 text-sm sm:flex">
				{STEPS.map((label, i) => {
					const n = i + 1;
					return (
						<div key={label} className="flex items-center gap-3">
							<div
								className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium ${
									step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
								}`}
							>
								{step > n ? <Check className="size-3.5" /> : n}
							</div>
							<span className={`whitespace-nowrap ${step === n ? "font-medium" : "text-muted-foreground"}`}>
								{label}
							</span>
							{n < STEPS.length && <div className="h-px w-10 shrink-0 bg-border" />}
						</div>
					);
				})}
			</div>
		</div>
	);
}