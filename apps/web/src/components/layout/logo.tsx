"use client";

import { useEffect, useState } from "react";
import { usePlatformInfo } from "@/lib/use-platform-info";

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
	const company = usePlatformInfo();

	// Handles null, undefined, and empty strings
	const src = logoUrl?.trim() || company.logoUrl;

	// A new address deserves a new try (e.g. right after a logo upload replaced a broken one).
	useEffect(() => setFailed(false), [src]);
	const displayName = name ?? company.name;

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

	// Plain <img>, not next/image: logos come from storage (Supabase), a custom domain or a local dev server, and the
	// image optimizer only serves hosts listed in next.config. A 32px logo gains nothing from it; the letter above is the fallback.
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={src}
			alt={`${displayName} logo`}
			width={size}
			height={size}
			className="rounded-lg object-contain"
			onError={() => setFailed(true)}
		/>
	);
}
