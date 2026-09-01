"use client";

import { Button } from "@/components/ui/button";
import { QuickEntryGrid } from "@/features/students/components/quick-entry-grid";

export function StudentsStep({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
	return (
		<div className="space-y-5">
			<div>
				<h2 className="text-lg font-semibold">Add your first students</h2>
				<p className="mt-1 text-sm text-muted-foreground">Optional — you can always add students later.</p>
			</div>

			<QuickEntryGrid onDone={onFinish} />

			<div className="flex justify-between border-t border-border pt-4">
				<Button variant="ghost" onClick={onBack}>Back</Button>
				<Button variant="outline" onClick={onFinish}>Skip and go to dashboard</Button>
			</div>
		</div>
	);
}