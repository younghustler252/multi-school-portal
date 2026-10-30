"use client";

import Image from "next/image";
import { useState } from "react";
import { COMPANY } from "@/config/company";

interface LogoProps {
	logoUrl?: string | null;
	name?: string;
	size?: number;
}

export function Logo({
	logoUrl,
	name,
	size = 32,
}: LogoProps) {
	const [failed, setFailed] = useState(false);

	// Handles null, undefined, and empty strings
	const src = logoUrl?.trim() || COMPANY.logoUrl;
	const displayName = name ?? COMPANY.name;

	// Show fallback if there's no image or it failed to load
	if (!src || failed) {
		return (
			<div
				style={{ width: size, height: size }}
				className="grid place-items-center rounded-lg bg-primary font-bold text-primary-foreground"
			>
				{displayName.charAt(0).toUpperCase()}
			</div>
		);
	}

	return (
		<Image
			src={src}
			alt={`${displayName} logo`}
			width={size}
			height={size}
			className="rounded-lg object-contain"
			onError={() => setFailed(true)}
		/>
	);
}