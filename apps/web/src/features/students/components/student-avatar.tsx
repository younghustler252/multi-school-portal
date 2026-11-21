import { PersonAvatar } from "@/components/ui/person-avatar";

interface StudentAvatarProps {
	photoUrl: string | null;
	firstName: string;
	lastName: string;
	size?: number;
}

/** Kept for its existing callers; the avatar itself (photo, load-failure fallback, initials) is the shared PersonAvatar. */
export function StudentAvatar({ photoUrl, firstName, lastName, size = 36 }: StudentAvatarProps) {
	return <PersonAvatar photoUrl={photoUrl} firstName={firstName} lastName={lastName} size={size} />;
}
