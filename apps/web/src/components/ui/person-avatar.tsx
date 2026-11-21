"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fullName, initialsOf, type PersonName } from "@/lib/people";
import { cn } from "@/lib/utils";

/*
| The one way to show a person: staff, student, guardian, the signed-in user.
|   - Shows the stored photo (`photoUrl`, exactly as the API returned it: nothing is built or guessed here).
|   - No photo, an empty value, or a photo that fails to load: initials on a neutral tint. The underlying Base UI
|     Avatar swaps to the fallback by itself, so there is never a broken-image icon or an empty circle.
|   - Fixed square box with object-cover, so the aspect ratio is preserved at every size.
|   - The whole avatar is one labelled image for screen readers (the person's name); the inner <img> is decorative.
*/

const SIZES = {
	xs: { box: "size-6", text: "text-[10px]" },
	sm: { box: "size-8", text: "text-xs" },
	md: { box: "size-10", text: "text-sm" },
	lg: { box: "size-14", text: "text-lg" },
	xl: { box: "size-24", text: "text-3xl" },
} as const;

export type PersonAvatarSize = keyof typeof SIZES;

interface PersonAvatarProps extends PersonName {
	photoUrl?: string | null;
	/** Used for initials and the accessible name when there is no name, e.g. the email address. */
	fallbackText?: string | null;
	/** A named size, or a pixel size for places that already pass one. */
	size?: PersonAvatarSize | number;
	className?: string;
}

export function PersonAvatar({
	firstName,
	lastName,
	photoUrl,
	fallbackText,
	size = "md",
	className,
}: PersonAvatarProps) {
	const name = fullName({ firstName, lastName }, fallbackText?.trim() || "Profile photo");
	const initials = initialsOf({ firstName, lastName }, fallbackText);
	const preset = typeof size === "string" ? SIZES[size] : null;

	return (
		<Avatar
			role="img"
			aria-label={name}
			className={cn(preset?.box, className)}
			style={typeof size === "number" ? { width: size, height: size } : undefined}
		>
			<AvatarImage src={photoUrl?.trim() || undefined} alt="" />
			<AvatarFallback
				className={cn("bg-accent font-semibold tracking-tight text-accent-foreground", preset?.text)}
				style={typeof size === "number" ? { fontSize: Math.max(10, Math.round(size * 0.38)) } : undefined}
			>
				{initials}
			</AvatarFallback>
		</Avatar>
	);
}
