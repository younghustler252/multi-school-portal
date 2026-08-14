"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SettingsTab {
	id: string;
	label: string;
	icon: LucideIcon;
}

interface SettingsNavProps {
	tabs: SettingsTab[];
	active: string;
	onChange: (id: string) => void;
}

export function SettingsNav({ tabs, active, onChange }: SettingsNavProps) {
	return (
		<>
			{/* Mobile: horizontal scrollable pills */}
			<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = active === tab.id;
					return (
						<button
							key={tab.id}
							onClick={() => onChange(tab.id)}
							className={cn(
								"flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
								isActive
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-card/60 text-muted-foreground"
							)}
						>
							<Icon className="size-3.5" />
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Desktop: vertical sidebar */}
			<aside className="hidden space-y-1 text-sm lg:block">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = active === tab.id;
					return (
						<button
							key={tab.id}
							onClick={() => onChange(tab.id)}
							className={cn(
								"flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors",
								isActive
									? "bg-primary/10 font-medium text-primary"
									: "text-muted-foreground hover:bg-muted"
							)}
						>
							<Icon className="size-4" />
							{tab.label}
						</button>
					);
				})}
			</aside>
		</>
	);
}