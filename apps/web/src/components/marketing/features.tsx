import {
	Users,
	CalendarCheck,
	BookMarked,
	Receipt,
	GraduationCap,
	Shield,
	type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FeatureItem {
	icon: LucideIcon;
	title: string;
	description: string;
}

const FEATURES: FeatureItem[] = [
	{
		icon: Users,
		title: "Student records",
		description: "Profiles, admissions, class assignment and guardian contacts in one place.",
	},
	{
		icon: CalendarCheck,
		title: "Attendance tracking",
		description: "Daily marking, calendar view and class-by-class analytics.",
	},
	{
		icon: BookMarked,
		title: "Grade management",
		description: "CA + exam scoring with WAEC-style A1–F9 auto-grading and report cards.",
	},
	{
		icon: Receipt,
		title: "Fee management",
		description: "Issue invoices in Naira, track payments and surface outstanding balances.",
	},
	{
		icon: GraduationCap,
		title: "Role-based portals",
		description: "Tailored experiences for admins, teachers, students and parents.",
	},
	{
		icon: Shield,
		title: "Multi-tenant secure",
		description: "Every school gets its own subdomain and isolated data with audit trails.",
	},
];

export function Features() {
	return (
		<section id="features" className="py-24">
			<div className="mx-auto max-w-6xl px-4 md:px-6">
				<div className="max-w-2xl">
					<Badge variant="secondary">Features</Badge>
					<h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
						Everything to run your school
					</h2>
					<p className="mt-3 text-muted-foreground">
						Move records, attendance, grades and fees onto a single, calm
						system that your whole school understands.
					</p>
				</div>

				<div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map(({ icon: Icon, title, description }) => (
						<div
							key={title}
							className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm transition-colors hover:border-primary/40"
						>
							<div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
								<Icon className="size-5" />
							</div>
							<h3 className="font-medium">{title}</h3>
							<p className="mt-2 text-sm text-muted-foreground">{description}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}