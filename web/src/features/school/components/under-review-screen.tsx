import { Clock } from "lucide-react";

export function UnderReviewScreen() {
	return (
		<div className="text-center">
			<div className="mx-auto grid size-12 place-items-center rounded-full bg-warning/15">
				<Clock className="size-6 text-warning-foreground" />
			</div>
			<h1 className="mt-4 text-xl font-semibold tracking-tight">Application under review</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				We&apos;re reviewing your documents. This usually takes 1–2 business days.
				You&apos;ll be able to access your school portal as soon as you&apos;re approved —
				feel free to check back, or log in again later.
			</p>
		</div>
	);
}