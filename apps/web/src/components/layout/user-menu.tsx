"use client";

import { useRouter } from "next/navigation";
import { LogOut, MessageSquarePlus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { fullName, sessionLabel } from "@/lib/people";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/stores/auth.store";

interface UserMenuProps {
	/** School sessions: opens the feedback dialog. Omit where there is none (platform). */
	onFeedback?: () => void;
	/** The /settings page belongs to school sessions, so the platform shell turns this off. */
	showAccountSettings?: boolean;
}

/** Who is signed in, with their real photo (or initials), and the account actions. Shared by both shells. */
export function UserMenu({ onFeedback, showAccountSettings = true }: UserMenuProps) {
	const router = useRouter();
	const user = useAuthStore((s) => s.user);
	const permissions = useAuthStore((s) => s.permissions);
	const logout = useAuthStore((s) => s.logout);

	const name = fullName({ firstName: user?.firstName, lastName: user?.lastName }, user?.email ?? "Account");
	const kind = sessionLabel(permissions?.realm ?? "school", permissions?.persona);

	async function handleLogout() {
		await logout();
		router.replace(ROUTES.auth.login);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button type="button" variant="ghost" aria-label="Account menu" className="h-auto gap-2 rounded-full py-1 pr-2 pl-1 pointer-coarse:h-11">
						<PersonAvatar firstName={user?.firstName} lastName={user?.lastName} photoUrl={user?.photoUrl} fallbackText={user?.email} size="sm" />
						<span className="hidden max-w-32 truncate text-sm font-medium md:inline">{user?.firstName ?? "Account"}</span>
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
				<div className="flex items-center gap-3 px-2 py-2.5">
					<PersonAvatar firstName={user?.firstName} lastName={user?.lastName} photoUrl={user?.photoUrl} fallbackText={user?.email} size="md" />
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-semibold">{name}</div>
						{user?.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
					</div>
					<Badge variant="secondary" className="shrink-0">{kind}</Badge>
				</div>
				<DropdownMenuSeparator />
				{showAccountSettings && (
					<DropdownMenuItem onClick={() => router.push(ROUTES.settings)} className="min-h-9 pointer-coarse:min-h-11">
						<Settings /> Account settings
					</DropdownMenuItem>
				)}
				{onFeedback && (
					<DropdownMenuItem onClick={onFeedback} className="min-h-9 pointer-coarse:min-h-11">
						<MessageSquarePlus /> Send feedback
					</DropdownMenuItem>
				)}
				{(showAccountSettings || onFeedback) && <DropdownMenuSeparator />}
				<DropdownMenuItem onClick={handleLogout} className="min-h-9 pointer-coarse:min-h-11">
					<LogOut /> Log out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
