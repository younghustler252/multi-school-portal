"use client";

import { useState } from "react";
import { Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateSubject } from "@/features/classes/hooks/use-classes";
import { ApiErrorResponse } from "@/types/api-response";

const COMMON_SUBJECTS = [
	"Mathematics", "English Language", "Basic Science", "Basic Technology",
	"Social Studies", "Civic Education", "Physics", "Chemistry", "Biology",
	"Agricultural Science", "Economics", "Government", "Literature in English",
	"French", "Christian Religious Studies", "Islamic Religious Studies",
	"Computer Studies", "Physical and Health Education",
];

export function SubjectsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [isCreating, setIsCreating] = useState(false);
	const createSubject = useCreateSubject();

	function toggle(name: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(name) ? next.delete(name) : next.add(name);
			return next;
		});
	}

	async function handleCreateAll() {
		if (selected.size === 0) { onNext(); return; }
		setIsCreating(true);
		try {
			await Promise.all(Array.from(selected).map((name) => createSubject.mutateAsync({ name })));
			toast.success(`${selected.size} subjects created`);
			onNext();
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Some subjects couldn't be created");
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="text-center">
				<div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
					<BookOpen className="size-6 text-primary" />
				</div>
				<h1 className="mt-4 text-xl font-semibold tracking-tight">Set up your subjects</h1>
				<p className="mt-1.5 text-sm text-muted-foreground">Select the subjects your school teaches — add more anytime later.</p>
			</div>

			<div className="flex max-h-64 flex-wrap justify-center gap-2 overflow-y-auto">
				{COMMON_SUBJECTS.map((name) => (
					<button
						key={name}
						type="button"
						onClick={() => toggle(name)}
						className={`rounded-full border px-4 py-2 text-sm transition-colors ${
							selected.has(name) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"
						}`}
					>
						{name}
					</button>
				))}
			</div>

			<div className="flex items-center justify-between pt-2">
				<Button variant="ghost" onClick={onBack}>Back</Button>
				<Button size="lg" onClick={handleCreateAll} disabled={isCreating}>
					{isCreating && <Loader2 className="size-4 animate-spin" />}
					{selected.size > 0 ? `Create ${selected.size} subjects` : "Continue"}
				</Button>
			</div>
		</div>
	);
}