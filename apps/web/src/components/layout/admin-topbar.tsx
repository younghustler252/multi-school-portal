"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
	return (
		<header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:h-16 md:gap-3 md:px-6">
			<Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
				<Menu aria-hidden="true" />
			</Button>

			<CommandPalette />

			<div className="flex-1" />

			<ThemeToggle />
			<UserMenu showAccountSettings={false} />
		</header>
	);
}
