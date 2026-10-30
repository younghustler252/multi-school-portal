"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	ClipboardCheck,
	Wallet,
	Users,
} from "lucide-react";

const ROLES = [
	{
		key: "admin",
		label: "School Admin",
		icon: LayoutDashboard,
		headline: "Run the whole school from one screen.",
		description:
			"Register students, manage staff, track every class and term — full visibility without chasing paper across offices.",
	},
	{
		key: "teacher",
		label: "Teacher",
		icon: ClipboardCheck,
		headline: "Mark attendance and grades in minutes.",
		description:
			"Your classes and subjects only — take attendance, enter CA and exam scores, and let the system compute positions automatically.",
	},
	{
		key: "bursar",
		label: "Bursar",
		icon: Wallet,
		headline: "Know exactly who has paid, and who hasn't.",
		description:
			"Invoice fees per term, track balances in real time, and see a clear defaulters list — no more manually reconciling bank alerts.",
	},
	{
		key: "guardian",
		label: "Parent",
		icon: Users,
		headline: "See your child's school life, instantly.",
		description:
			"Report cards, attendance, and fee invoices — view online and pay directly, without a single trip to the school office.",
	},
] as const;

export function RoleShowcase() {
	const [active, setActive] = useState<(typeof ROLES)[number]["key"]>("admin");
	const activeRole = ROLES.find((r) => r.key === active)!;
	const Icon = activeRole.icon;

	return (
		<section className="py-16 md:py-24">
			<div className="mx-auto max-w-6xl px-4 md:px-6">
				<div className="max-w-2xl">
					<h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
						One portal. A different view for everyone.
					</h2>
					<p className="mt-3 text-muted-foreground">
						Every role only sees what's relevant to them — nothing more, nothing less.
					</p>
				</div>

				<div className="mt-10 flex flex-wrap gap-2">
					{ROLES.map((role) => (
						<button
							key={role.key}
							onClick={() => setActive(role.key)}
							className={cn(
								"rounded-full border px-4 py-2 text-sm font-medium transition-colors",
								active === role.key
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-card/60 text-muted-foreground hover:text-foreground"
							)}
						>
							{role.label}
						</button>
					))}
				</div>

				<div className="mt-8 rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-sm md:p-12">
					<div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
						<div className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
							<Icon className="size-7" />
						</div>
						<div>
							<h3 className="text-xl font-semibold tracking-tight md:text-2xl">
								{activeRole.headline}
							</h3>
							<p className="mt-3 max-w-xl text-muted-foreground">
								{activeRole.description}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}