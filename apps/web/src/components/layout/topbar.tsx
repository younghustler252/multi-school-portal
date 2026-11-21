"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { FeedbackDialog } from "@/features/feedback/components/feedback-dialog";
import { notificationsPath } from "@/lib/nav-model";
import { useAuthStore } from "@/stores/auth.store";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const persona = useAuthStore((s) => s.permissions?.persona ?? null);

	return (
		<header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:h-16 md:gap-3 md:px-6">
			<Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
				<Menu aria-hidden="true" />
			</Button>

			<CommandPalette />

			<div className="flex-1" />

			<ThemeToggle />
			<NotificationBell inboxPath={notificationsPath("school", persona)} />
			<UserMenu onFeedback={() => setFeedbackOpen(true)} />

			<FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
		</header>
	);
}
