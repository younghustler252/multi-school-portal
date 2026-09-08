"use client";

import { useState } from "react";
import { FileSpreadsheet, Sparkles, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickEntryGrid } from "@/features/students/components/quick-entry-grid";
import {ImportStudentsDialog} from "@/features/students/components/import-student-dialog";

export function StudentsStep({
	onFinish,
	onBack,
}: {
	onFinish: () => void;
	onBack: () => void;
}) {
	const [mode, setMode] = useState<"new" | "existing">("new");
	const [showQuickEntry, setShowQuickEntry] = useState(false);
	const [showImport, setShowImport] = useState(false);

	return (
		<div className="space-y-6">
			<div className="text-center">
				<div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
					<Users className="size-6 text-primary" />
				</div>

				<h1 className="mt-4 text-xl font-semibold tracking-tight">
					Add your students
				</h1>

				<p className="mt-1.5 text-sm text-muted-foreground">
					Bring your student records into the portal. You can add
					students manually or import existing records.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<ChoiceCard
					title="New school"
					description="I'm starting from scratch and want to add students manually."
					icon={<Sparkles className="size-5" />}
					selected={mode === "new"}
					onClick={() => setMode("new")}
				/>

				<ChoiceCard
					title="Existing school"
					description="We already have student records and want to import them."
					icon={<FileSpreadsheet className="size-5" />}
					selected={mode === "existing"}
					onClick={() => setMode("existing")}
				/>
			</div>

			{mode === "new" && (
				<div className="rounded-xl border border-primary/25 bg-primary/5 p-5">
					<div className="font-medium text-sm">
						Great! Let's add your first students.
					</div>

					<p className="mt-1 text-sm text-muted-foreground">
						Add students one at a time using the quick entry
						form. You can always add more students later from
						the Students section.
					</p>

					{showQuickEntry ? (
						<div className="mt-5">
							<QuickEntryGrid onDone={onFinish} />
						</div>
					) : (
						<div className="mt-4 flex flex-wrap gap-2">
							<Button
								size="sm"
								onClick={() => setShowQuickEntry(true)}
							>
								Add students
							</Button>

							<Button
								size="sm"
								variant="outline"
								onClick={() => setMode("existing")}
							>
								Import existing records
							</Button>
						</div>
					)}
				</div>
			)}

			{mode === "existing" && (
				<div className="rounded-xl border border-border bg-card p-5">
					<div className="flex items-start gap-3">
						<div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
							<FileSpreadsheet className="size-5" />
						</div>

						<div>
							<div className="font-medium text-sm">
								Import your existing student records
							</div>

							<p className="mt-1 text-sm text-muted-foreground">
								Upload a CSV file containing your student
								records. You can download the import
								template and prepare your data before
								uploading.
							</p>
						</div>
					</div>

					<div className="mt-4 flex flex-wrap gap-2">
						<Button
							onClick={() => setShowImport(true)}
							className="gap-2"
						>
							<Upload className="size-4" />
							Import students
						</Button>

						<Button
							variant="outline"
							onClick={() => setMode("new")}
						>
							Add manually instead
						</Button>
					</div>
				</div>
			)}

			<div className="flex items-center justify-between border-t border-border pt-5">
				<Button variant="ghost" onClick={onBack}>
					Back
				</Button>

				<Button variant="outline" onClick={onFinish}>
					Skip for now
				</Button>
			</div>

			<ImportStudentsDialog
				open={showImport}
				onOpenChange={setShowImport}
			/>
		</div>
	);
}

function ChoiceCard({
	title,
	description,
	icon,
	selected,
	onClick,
}: {
	title: string;
	description: string;
	icon: React.ReactNode;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-xl border p-5 text-left transition-colors ${
				selected
					? "border-primary bg-primary/5 ring-1 ring-primary/30"
					: "border-border hover:border-primary/40 hover:bg-muted/30"
			}`}
		>
			<div className="flex items-start justify-between">
				<div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
					{icon}
				</div>

				{selected && (
					<span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
						Selected
					</span>
				)}
			</div>

			<div className="mt-3 font-semibold">{title}</div>

			<p className="mt-1 text-sm text-muted-foreground">
				{description}
			</p>
		</button>
	);
}
