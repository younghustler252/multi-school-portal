import { useRef, useState, type ReactNode } from "react";
import {
	CheckCircle2,
	Clock,
	FileText,
	ImageIcon,
	RefreshCw,
	Upload,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format-bytes";

export type PickedFile = {
	name: string;
	size: number;
	type: string;
	dataUrl: string;
	file: File;
};

type ExistingFile = {
	name: string;
	size?: number;
	type?: string;
	dataUrl?: string;
	status?: "pending" | "approved" | "rejected";
	uploadedAt?: string;
	rejectionReason?: string | null;
};

type FileDropProps = {
	accept: string;
	readAsDataUrl?: boolean;
	title: string;
	hint: string;
	file?: ExistingFile | null;
	onPicked: (file: PickedFile) => void;
	onRemove: () => void;
	preview?: "image" | "doc";
	footer?: ReactNode;
	disabled?: boolean;
};

export function FileDrop({
	accept,
	readAsDataUrl = false,
	title,
	hint,
	file,
	onPicked,
	onRemove,
	preview = "doc",
	footer,
	disabled = false,
}: FileDropProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	function validateFile(selectedFile: File) {
		const acceptedTypes = accept
			.split(",")
			.map((type) => type.trim().toLowerCase());

		const extension = `.${selectedFile.name
			.split(".")
			.pop()
			?.toLowerCase() ?? ""}`;

		const matches = acceptedTypes.some((type) => {
			return (
				type === extension ||
				type === selectedFile.type ||
				(type.endsWith("/*") &&
					selectedFile.type.startsWith(type.slice(0, -1)))
			);
		});

		if (!matches) {
			setError(`That file type isn't supported. Accepted: ${accept}`);
			return false;
		}

		if (selectedFile.size > 10 * 1024 * 1024) {
			setError(
				"File is larger than 10MB. Please upload a smaller file.",
			);
			return false;
		}

		return true;
	}

	function processFile(selectedFile: File) {
		if (disabled || !validateFile(selectedFile)) return;

		setError(null);
		setProgress(0);

		const finish = (dataUrl: string) => {
			let currentProgress = 0;

			const timer = setInterval(() => {
				currentProgress += Math.random() * 20 + 10;

				if (currentProgress >= 100) {
					clearInterval(timer);
					setProgress(100);

					setTimeout(() => {
						setProgress(null);

						onPicked({
							name: selectedFile.name,
							size: selectedFile.size,
							type: selectedFile.type,
							dataUrl,
							file: selectedFile,
						});
					}, 300);

					return;
				}

				setProgress(Math.round(currentProgress));
			}, 180);
		};

		if (readAsDataUrl) {
			const reader = new FileReader();

			reader.onload = () => {
				finish(String(reader.result ?? ""));
			};

			reader.onerror = () => {
				setProgress(null);
				setError(
					"We couldn't read that file. Try another one.",
				);
			};

			reader.readAsDataURL(selectedFile);
			return;
		}

		finish("");
	}

	function handleInputChange(
		event: React.ChangeEvent<HTMLInputElement>,
	) {
		const selectedFile = event.target.files?.[0];

		if (selectedFile) {
			processFile(selectedFile);
		}

		event.target.value = "";
	}

	function handleDrop(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setIsDragging(false);

		if (disabled) return;

		const selectedFile = event.dataTransfer.files?.[0];

		if (selectedFile) {
			processFile(selectedFile);
		}
	}

	function getStatusLabel() {
		if (!file?.status) return "Attached";

		switch (file.status) {
			case "approved":
				return "Approved";
			case "rejected":
				return "Rejected";
			case "pending":
				return "Pending review";
		}
	}

	function getStatusIcon() {
		if (!file?.status) {
			return <CheckCircle2 className="size-3.5" />;
		}

		switch (file.status) {
			case "approved":
				return <CheckCircle2 className="size-3.5" />;
			case "rejected":
				return <X className="size-3.5" />;
			case "pending":
				return <Clock className="size-3.5" />;
		}
	}

	function getStatusClasses() {
		if (!file?.status) {
			return "bg-success/10 text-success";
		}

		switch (file.status) {
			case "approved":
				return "bg-success/10 text-success";
			case "rejected":
				return "bg-destructive/10 text-destructive";
			case "pending":
				return "bg-warning/10 text-warning-foreground";
		}
	}

	if (progress !== null) {
		return (
			<div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
				<div className="flex items-center gap-3">
					<div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
						<RefreshCw className="size-4 animate-spin" />
					</div>

					<div className="min-w-0">
						<div className="text-sm font-medium">
							Uploading document
						</div>

						<div className="mt-0.5 text-xs text-muted-foreground">
							Please keep this window open
						</div>
					</div>

					<span className="ml-auto text-sm font-medium text-primary">
						{progress}%
					</span>
				</div>

				<div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-primary transition-all duration-200"
						style={{ width: `${progress}%` }}
					/>
				</div>
			</div>
		);
	}

	if (file?.name) {
		return (
			<div
				className={`rounded-xl border p-5 ${
					file.status === "approved"
						? "border-success/30 bg-success/5"
						: file.status === "rejected"
							? "border-destructive/30 bg-destructive/5"
							: file.status === "pending"
								? "border-warning/30 bg-warning/5"
								: "border-success/30 bg-success/5"
				}`}
			>
				<div className="flex items-start gap-4">
					<div
						className={`grid size-12 shrink-0 place-items-center rounded-lg ${
							file.status === "rejected"
								? "bg-destructive/10 text-destructive"
								: file.status === "pending"
									? "bg-warning/10 text-warning-foreground"
									: "bg-success/10 text-success"
						}`}
					>
						{preview === "image" && file.dataUrl ? (
							<img
								src={file.dataUrl}
								alt={file.name}
								className="size-12 rounded-lg object-cover"
							/>
						) : preview === "image" ? (
							<ImageIcon className="size-5" />
						) : (
							<FileText className="size-5" />
						)}
					</div>

					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="truncate text-sm font-medium">
								{file.name}
							</span>
						</div>

						<div className="mt-1 text-xs text-muted-foreground">
							{file.size !== undefined
								? formatBytes(file.size)
								: "Document"}
							{file.type ? ` · ${file.type}` : ""}
						</div>

						{file.uploadedAt && (
							<div className="mt-1 text-xs text-muted-foreground">
								Uploaded{" "}
								{new Date(
									file.uploadedAt,
								).toLocaleDateString("en-NG", {
									day: "numeric",
									month: "long",
									year: "numeric",
								})}
							</div>
						)}

						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={disabled}
								onClick={() =>
									inputRef.current?.click()
								}
							>
								Replace
							</Button>

							<Button
								type="button"
								size="sm"
								variant="ghost"
								disabled={disabled}
								onClick={onRemove}
								className="gap-1 text-muted-foreground"
							>
								<X className="size-3.5" />
								Remove
							</Button>
						</div>
					</div>

					<div
						className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex ${getStatusClasses()}`}
					>
						{getStatusIcon()}
						{getStatusLabel()}
					</div>
				</div>

				{file.status === "rejected" &&
					file.rejectionReason && (
						<div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
							<div className="font-medium">
								Reason for rejection
							</div>

							<p className="mt-1">
								{file.rejectionReason}
							</p>
						</div>
					)}

				{footer}

				<input
					ref={inputRef}
					type="file"
					accept={accept}
					className="hidden"
					disabled={disabled}
					onChange={handleInputChange}
				/>
			</div>
		);
	}

	return (
		<div>
			<div
				role="button"
				tabIndex={disabled ? -1 : 0}
				onKeyDown={(event) => {
					if (
						!disabled &&
						(event.key === "Enter" ||
							event.key === " ")
					) {
						event.preventDefault();
						inputRef.current?.click();
					}
				}}
				onClick={() =>
					!disabled && inputRef.current?.click()
				}
				onDragOver={(event) => {
					if (disabled) return;

					event.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={handleDrop}
				className={`rounded-xl border-2 border-dashed p-7 text-center transition-colors ${
					disabled
						? "cursor-not-allowed border-border bg-muted/30 opacity-60"
						: isDragging
							? "cursor-pointer border-primary bg-primary/5"
							: "cursor-pointer border-border bg-muted/10 hover:border-primary/50 hover:bg-primary/[0.02]"
				}`}
			>
				<div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
					<Upload className="size-5" />
				</div>

				<div className="mt-4 text-sm font-medium">
					{title}
				</div>

				<div className="mt-1 text-xs text-muted-foreground">
					{hint}
				</div>

				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={disabled}
					className="mt-4"
				>
					<Upload className="size-3.5" />
					Browse files
				</Button>
			</div>

			{error && (
				<p className="mt-2 text-xs text-destructive">
					{error}
				</p>
			)}

			<input
				ref={inputRef}
				type="file"
				accept={accept}
				className="hidden"
				disabled={disabled}
				onChange={handleInputChange}
			/>
		</div>
	);
}
