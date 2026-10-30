interface StudentAvatarProps {
	photoUrl: string | null;
	firstName: string;
	lastName: string;
	size?: number;
}

export function StudentAvatar({ photoUrl, firstName, lastName, size = 36 }: StudentAvatarProps) {
	if (photoUrl) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={photoUrl}
				alt={`${firstName} ${lastName}`}
				style={{ width: size, height: size }}
				className="rounded-full object-cover"
			/>
		);
	}
	return (
		<div
			style={{ width: size, height: size }}
			className="grid place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
		>
			{firstName.charAt(0)}
			{lastName.charAt(0)}
		</div>
	);
}