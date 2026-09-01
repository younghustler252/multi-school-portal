"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateClass } from "@/features/classes/hooks/use-classes";
import { ApiErrorResponse } from "@/types/api-response";

const COMMON_CLASSES = [
	"Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
	"JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3",
];

export function ClassesStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [isCreating, setIsCreating] = useState(false);
	const createClass = useCreateClass();

	function toggle(name: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(name) ? next.delete(name) : next.add(name);
			return next;
		});
	}

	async function handleCreateAll() {
		if (selected.size === 0) {
			onNext();
			return;
		}
		setIsCreating(true);
		try {
			await Promise.all(Array.from(selected).map((name) => createClass.mutateAsync({ name })));
			toast.success(`${selected.size} classes created`);
			onNext();
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Some classes couldn't be created");
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<div className="space-y-5">
			<div>
				<h2 className="text-lg font-semibold">Set up your classes</h2>
				<p className="mt-1 text-sm text-muted-foreground">Select the classes your school has — you can add more later.</p>
			</div>

			<div className="flex flex-wrap gap-2">
				{COMMON_CLASSES.map((name) => (
					<button
						key={name}
						type="button"
						onClick={() => toggle(name)}
						className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
							selected.has(name) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"
						}`}
					>
						{name}
					</button>
				))}
			</div>

			<div className="flex justify-between">
				<Button variant="ghost" onClick={onBack}>Back</Button>
				<Button onClick={handleCreateAll} disabled={isCreating}>
					{isCreating && <Loader2 className="size-4 animate-spin" />}
					{selected.size > 0 ? `Create ${selected.size} classes` : "Skip"}
				</Button>
			</div>
		</div>
	);
}