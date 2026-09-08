"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Search, Sun, Moon, UserCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth.store";

export function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const router = useRouter();
	const logout = useAuthStore((s) => s.logout);
	const user = useAuthStore((s) => s.user);

	useEffect(() => { setMounted(true); }, []);

	function handleLogout() {
		logout();
		router.push("/login");
	}

	return (
		<header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
			<button className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
				<Menu className="size-5" />
			</button>

			<div className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 md:flex">
				<Search className="size-4 text-muted-foreground" />
				<input placeholder="Search schools, users…" className="flex-1 bg-transparent text-sm outline-none" />
			</div>

			<div className="flex-1 md:hidden" />

			<Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
				{mounted && theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
			</Button>

			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="ghost" size="sm" className="gap-2">
							<UserCircle className="size-4" />
							<span className="hidden text-sm sm:inline">{user?.firstName}</span>
						</Button>
					}
				/>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={handleLogout}>
						<LogOut className="size-4" /> Log out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</header>
	);
}