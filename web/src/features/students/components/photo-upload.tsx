"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { studentApi } from "@/features/students/services/student.api";

interface PhotoUploadProps {
	studentId: string;
	photoUrl: string | null;
	firstName: string;
	lastName: string;
	onUploaded: (url: string) => void;
}

export function PhotoUpload({ studentId, photoUrl, firstName, lastName, onUploaded }: PhotoUploadProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);

	async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		try {
			const res = await studentApi.uploadPhoto(studentId, file);
			if (res.success) {
				onUploaded(res.data.url);
				toast.success("Photo updated");
			} else {
				toast.error(res.message);
			}
		} catch {
			toast.error("Couldn't upload photo");
		} finally {
			setIsUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	return (
		<div className="relative">
			<input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				disabled={isUploading}
				className="group relative block size-20 overflow-hidden rounded-full border border-border bg-primary/10"
			>
				{photoUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={photoUrl} alt={`${firstName} ${lastName}`} className="size-full object-cover" />
				) : (
					<div className="grid size-full place-items-center text-lg font-semibold text-primary">
						{firstName.charAt(0)}
						{lastName.charAt(0)}
					</div>
				)}

				<div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
					{isUploading ? (
						<Loader2 className="size-5 animate-spin text-white" />
					) : (
						<Camera className="size-5 text-white" />
					)}
				</div>
			</button>
		</div>
	);
}