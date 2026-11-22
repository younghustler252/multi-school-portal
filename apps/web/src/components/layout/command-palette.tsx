"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { NAV_ICONS } from "@/lib/nav-config";
import { visibleNav, type NavEntry } from "@/lib/nav-model";
import { useAuthStore } from "@/stores/auth.store";

/*
| "Jump to a page": Ctrl/Cmd+K or the search button. It lists exactly the pages in the sidebar, from the same
| permission-filtered list (visibleNav), so it can never offer a page the person cannot open.
| It searches pages, not records: there is no records search in the API contract yet.
*/
export function CommandPalette() {
	const router = useRouter();
	const permissions = useAuthStore((s) => s.permissions);
	const [open, setOpen] = useState(false);
	// "Ctrl" until we know; only a hint in the button, so a wrong guess is harmless.
	const [shortcut, setShortcut] = useState("Ctrl");

	useEffect(() => {
		if (/mac|iphone|ipad/i.test(navigator.userAgent)) setShortcut("⌘");
	}, []);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((current) => !current);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const groups = useMemo(() => {
		const byGroup = new Map<string, NavEntry[]>();
		for (const entry of visibleNav(permissions)) {
			const key = entry.groupLabel ?? "Pages";
			byGroup.set(key, [...(byGroup.get(key) ?? []), entry]);
		}
		return [...byGroup.entries()];
	}, [permissions]);

	function go(path: string) {
		setOpen(false);
		router.push(path);
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:flex"
			>
				<Search className="size-4 shrink-0" aria-hidden="true" />
				<span className="flex-1 truncate text-left">Jump to a page…</span>
				<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium">{shortcut} K</kbd>
			</button>
			<Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Jump to a page">
				<Search aria-hidden="true" />
			</Button>

			<CommandDialog open={open} onOpenChange={setOpen} title="Jump to a page" description="Search the pages you can open">
				<CommandInput placeholder="Jump to a page…" />
				<CommandList>
					<CommandEmpty>No matching page.</CommandEmpty>
					{groups.map(([label, entries]) => (
						<CommandGroup key={label} heading={label}>
							{entries.map((entry) => {
								const Icon = NAV_ICONS[entry.icon];
								return (
									<CommandItem key={entry.to} value={`${label} ${entry.label}`} onSelect={() => go(entry.to)}>
										<Icon aria-hidden="true" />
										{entry.label}
									</CommandItem>
								);
							})}
						</CommandGroup>
					))}
				</CommandList>
			</CommandDialog>
		</>
	);
}
