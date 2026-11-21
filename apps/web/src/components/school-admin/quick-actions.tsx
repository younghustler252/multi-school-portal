import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface QuickAction {
	href: string;
	label: string;
	icon: LucideIcon;
}

/** Shortcuts to pages the person can open. The caller passes only allowed ones; with none, nothing is rendered. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
	if (actions.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-section">Quick actions</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
					{actions.map(({ href, label, icon: Icon }) => (
						<li key={href}>
							<Link href={href} className={buttonVariants({ variant: "outline", className: "w-full justify-start" })}>
								<Icon aria-hidden="true" />
								{label}
							</Link>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
