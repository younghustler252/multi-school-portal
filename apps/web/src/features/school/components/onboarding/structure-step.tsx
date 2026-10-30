"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, School, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	useCreateClass,
	useCreateSubject,
} from "@/features/classes/hooks/use-classes";
import { ApiErrorResponse } from "@/types/api-response";

const PRIMARY_CLASSES = [
	"Primary 1",
	"Primary 2",
	"Primary 3",
	"Primary 4",
	"Primary 5",
	"Primary 6",
];

const JUNIOR_CLASSES = ["JSS 1", "JSS 2", "JSS 3"];

const SENIOR_CLASSES = ["SS 1", "SS 2", "SS 3"];

const COMMON_SUBJECTS = [
	"Mathematics",
	"English Language",
	"Basic Science",
	"Basic Technology",
	"Social Studies",
	"Civic Education",
	"Physics",
	"Chemistry",
	"Biology",
	"Agricultural Science",
	"Economics",
	"Government",
	"Literature in English",
	"French",
	"Christian Religious Studies",
	"Islamic Religious Studies",
	"Computer Studies",
	"Physical and Health Education",
];

function classesForCategory(category?: string): string[] {
	if (category === "primary") return PRIMARY_CLASSES;
	if (category === "secondary") {
		return [...JUNIOR_CLASSES, ...SENIOR_CLASSES];
	}

	return [
		...PRIMARY_CLASSES,
		...JUNIOR_CLASSES,
		...SENIOR_CLASSES,
	];
}

interface StructureStepProps {
	schoolCategory?: string;
	onNext: () => void;
	onBack: () => void;
}

export function StructureStep({
	schoolCategory,
	onNext,
	onBack,
}: StructureStepProps) {
	const [classes, setClasses] = useState<string[]>([]);
	const [subjects, setSubjects] = useState<string[]>([]);
	const [sections, setSections] = useState<string[]>([]);

	const [classInput, setClassInput] = useState("");
	const [subjectInput, setSubjectInput] = useState("");
	const [sectionInput, setSectionInput] = useState("");

	const [isCreating, setIsCreating] = useState(false);

	const createClass = useCreateClass();
	const createSubject = useCreateSubject();

	const presetClasses = classesForCategory(schoolCategory);

	// Automatically apply the appropriate Nigerian school preset
	// when the school category is already known.
	useEffect(() => {
		setClasses(presetClasses);
	}, [schoolCategory]);

	function applyPreset() {
		setClasses(presetClasses);
		setSubjects(COMMON_SUBJECTS);

		toast.success(
			"Nigerian school structure applied — edit anything you like",
		);
	}

	function addItem(
		value: string,
		items: string[],
		setItems: React.Dispatch<React.SetStateAction<string[]>>,
		setValue: React.Dispatch<React.SetStateAction<string>>,
		label: string,
	) {
		const trimmed = value.trim();

		if (!trimmed) return;

		if (items.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
			toast.error(`${trimmed} is already on the list`);
			return;
		}

		setItems((prev) => [...prev, trimmed]);
		setValue("");
	}

	function removeItem(
		value: string,
		setItems: React.Dispatch<React.SetStateAction<string[]>>,
	) {
		setItems((prev) => prev.filter((item) => item !== value));
	}

	async function handleContinue() {
		if (classes.length === 0) {
			toast.error("Add at least one class");
			return;
		}

		if (subjects.length === 0) {
			toast.error("Add at least one subject");
			return;
		}

		setIsCreating(true);

		try {
			await Promise.all(
				classes.map((name) =>
					createClass.mutateAsync({
						name,
					}),
				),
			);

			await Promise.all(
				subjects.map((name) =>
					createSubject.mutateAsync({
						name,
					}),
				),
			);

			toast.success(
				`${classes.length} classes and ${subjects.length} subjects created`,
			);

			onNext();
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			toast.error(
				apiErr.message ||
					"Some classes or subjects couldn't be created",
			);
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<div className="space-y-7">
			{/* Preset */}
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
				<div className="flex items-start gap-3">
					<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
						<Sparkles className="size-4" />
					</div>

					<div className="text-sm">
						<div className="font-medium">
							Use the Nigerian school structure
						</div>

						<div className="mt-0.5 text-xs text-muted-foreground">
							{schoolCategory === "primary"
								? "Primary 1–6 plus common subjects."
								: schoolCategory === "secondary"
									? "JSS 1–3 and SS 1–3 plus common subjects."
									: "Primary 1–6, JSS 1–3 and SS 1–3 plus common subjects."}
						</div>
					</div>
				</div>

				<Button
					type="button"
					size="sm"
					className="gap-2"
					onClick={applyPreset}
				>
					<Sparkles className="size-3.5" />
					Apply preset
				</Button>
			</div>

			{/* Classes */}
			<StructureEditor
				title="Classes"
				count={classes.length}
				placeholder="e.g. JSS 1"
				empty="No classes yet. Apply the preset above or add your first class."
				value={classInput}
				onChange={setClassInput}
				onAdd={() =>
					addItem(
						classInput,
						classes,
						setClasses,
						setClassInput,
						"class",
					)
				}
				items={classes}
				onRemove={(item) => removeItem(item, setClasses)}
			/>

			{/* Sections */}
			<StructureEditor
				title="Sections (class arms)"
				count={sections.length}
				placeholder="e.g. A"
				empty="No arms yet — add A, B, C…"
				value={sectionInput}
				onChange={setSectionInput}
				onAdd={() =>
					addItem(
						sectionInput,
						sections,
						setSections,
						setSectionInput,
						"section",
					)
				}
				items={sections}
				onRemove={(item) => removeItem(item, setSections)}
			/>

			{/* Subjects */}
			<div>
				<div className="mb-2 flex items-center justify-between">
					<div>
						<Label>Subjects</Label>
						<p className="mt-0.5 text-xs text-muted-foreground">
							Choose the subjects your school teaches.
						</p>
					</div>

					<span className="text-xs text-muted-foreground">
						{subjects.length} added
					</span>
				</div>

				<div className="flex gap-2">
					<Input
						value={subjectInput}
						placeholder="e.g. Mathematics"
						onChange={(e) => setSubjectInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();

								addItem(
									subjectInput,
									subjects,
									setSubjects,
									setSubjectInput,
									"subject",
								);
							}
						}}
					/>

					<Button
						type="button"
						variant="outline"
						onClick={() =>
							addItem(
								subjectInput,
								subjects,
								setSubjects,
								setSubjectInput,
								"subject",
							)
						}
						className="shrink-0 gap-1"
					>
						<Plus className="size-4" />
						Add
					</Button>
				</div>

				{subjects.length === 0 ? (
					<p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
						No subjects yet. Apply the preset or add subjects one by
						one.
					</p>
				) : (
					<div className="mt-3 flex flex-wrap gap-2">
						{subjects.map((subject) => (
							<StructureChip
								key={subject}
								label={subject}
								onRemove={() =>
									removeItem(subject, setSubjects)
								}
							/>
						))}
					</div>
				)}
			</div>

			{/* Preview */}
			{classes.length > 0 && (
				<div className="rounded-xl border border-border bg-card p-4">
					<div className="flex items-start gap-3">
						<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
							<School className="size-4" />
						</div>

						<div>
							<div className="text-sm font-medium">
								Structure preview
							</div>

							<div className="mt-1 text-xs text-muted-foreground">
								{classes.length} classes ×{" "}
								{Math.max(1, sections.length)} arms ={" "}
								{classes.length *
									Math.max(1, sections.length)}{" "}
								class groups, {subjects.length} subjects.
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="flex items-center justify-between border-t border-border pt-6">
				<Button
					type="button"
					variant="ghost"
					onClick={onBack}
					disabled={isCreating}
				>
					Back
				</Button>

				<Button
					type="button"
					size="lg"
					className="gap-2"
					onClick={handleContinue}
					disabled={isCreating}
				>
					{isCreating && (
						<Loader2 className="size-4 animate-spin" />
					)}

					{isCreating
						? "Setting up..."
						: "Continue"}
				</Button>
			</div>
		</div>
	);
}

interface StructureEditorProps {
	title: string;
	count: number;
	placeholder: string;
	empty: string;
	value: string;
	onChange: (value: string) => void;
	onAdd: () => void;
	items: string[];
	onRemove: (item: string) => void;
}

function StructureEditor({
	title,
	count,
	placeholder,
	empty,
	value,
	onChange,
	onAdd,
	items,
	onRemove,
}: StructureEditorProps) {
	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<Label>{title}</Label>

				<span className="text-xs text-muted-foreground">
					{count} added
				</span>
			</div>

			<div className="flex gap-2">
				<Input
					value={value}
					placeholder={placeholder}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							onAdd();
						}
					}}
				/>

				<Button
					type="button"
					variant="outline"
					onClick={onAdd}
					className="shrink-0 gap-1"
				>
					<Plus className="size-4" />
					Add
				</Button>
			</div>

			{items.length === 0 ? (
				<p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
					{empty}
				</p>
			) : (
				<div className="mt-3 flex flex-wrap gap-2">
					{items.map((item) => (
						<StructureChip
							key={item}
							label={item}
							onRemove={() => onRemove(item)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function StructureChip({
	label,
	onRemove,
}: {
	label: string;
	onRemove: () => void;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1.5 text-xs">
			{label}

			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${label}`}
				className="rounded-full p-0.5 transition-colors hover:bg-destructive/15 hover:text-destructive"
			>
				<X className="size-3" />
			</button>
		</span>
	);
}
