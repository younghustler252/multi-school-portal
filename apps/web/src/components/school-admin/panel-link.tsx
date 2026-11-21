import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** The small "Open …" link in a panel header. Only render it for a page the person may open. */
export function PanelLink({ href, children }: { href: string; children: string }) {
	return (
		<Link
			href={href}
			className="inline-flex min-h-8 items-center gap-1 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
		>
			{children}
			<ArrowRight className="size-3.5" aria-hidden="true" />
		</Link>
	);
}
