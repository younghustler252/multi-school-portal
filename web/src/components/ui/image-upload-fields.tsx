"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiResponse } from "@/types/api-response";

interface UploadFileResponseData {
	url: string;
}

interface ImageUploadFieldProps {
	label: string;
	currentUrl?: string | null;
	uploadFn: (file: File) => Promise<ApiResponse<UploadFileResponseData>>;
	onUploaded: (url: string) => void;
	accept?: string;
	shape?: "square" | "circle" | "wide";
}

export function ImageUploadField({
	label,
	currentUrl,
	uploadFn,
	onUploaded,
	accept = "image/*",
	shape = "square",
}: ImageUploadFieldProps) {
	const [isUploading, setIsUploading] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setIsUploading(true);
		try {
			const res = await uploadFn(file);
			if (res.success) {
				onUploaded(res.data.url);
				toast.success(`${label} updated`);
			} else {
				toast.error(res.message);
			}
		} catch {
			toast.error(`Couldn't upload ${label.toLowerCase()}`);
		} finally {
			setIsUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	const shapeClass =
		shape === "circle" ? "rounded-full" : shape === "wide" ? "rounded-lg aspect-[3/1]" : "rounded-lg";

	return (
		<div>
			<Label>{label}</Label>
			<div className="mt-2 flex items-center gap-3">
				<div className={`grid size-16 shrink-0 place-items-center overflow-hidden border border-border bg-muted ${shapeClass}`}>
					{currentUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={currentUrl} alt={label} className="size-full object-cover" />
					) : (
						<span className="text-[10px] text-muted-foreground">None</span>
					)}
				</div>
				<div>
					<input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
					<Button variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
						{isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
						{currentUrl ? "Replace" : "Upload"}
					</Button>
				</div>
			</div>
		</div>
	);
}