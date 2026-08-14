import { Check, X } from "lucide-react";
import { SettingsSection } from "./settings-section";
import { RBAC_MATRIX, type Module, type AccessLevel } from "@/lib/rbac";
import { ROLE_META } from "@/lib/nav-config";
import { Role } from "@/types/roles";

// Only roles relevant to a school admin viewing this — exclude super_admin
const VISIBLE_ROLES: Role[] = ["school_admin", "principal", "teacher", "bursar", "student", "guardian"];

const MODULE_LABELS: Record<Module, string> = {
	"super-admin": "Super Admin",
	plans: "Plans",
	subscriptions: "Subscriptions",
	school: "School Settings",
	staff: "Staff",
	students: "Students",
	enrolment: "Enrolment",
	classes: "Classes",
	attendance: "Attendance",
	grades: "Grades",
	"report-cards": "Report Cards",
	fees: "Fees",
	payments: "Payments",
	notifications: "Notifications",
	guardians: "Guardians",
};

// Exclude platform-only modules irrelevant to a school's own staff
const VISIBLE_MODULES: Module[] = [
	"school",
	"staff",
	"students",
	"enrolment",
	"classes",
	"attendance",
	"grades",
	"report-cards",
	"fees",
	"payments",
	"guardians",
];

function AccessBadge({ level }: { level: AccessLevel }) {
	if (level === "none") {
		return <X className="mx-auto size-4 text-muted-foreground/30" />;
	}
	if (level === "full") {
		return <Check className="mx-auto size-4 text-primary" />;
	}
	// "view" | "own" | "own_child" — partial access, show label instead of icon
	const labels: Record<string, string> = {
		view: "View only",
		own: "Own only",
		own_child: "Child only",
	};
	return <span className="text-xs text-muted-foreground">{labels[level]}</span>;
}

export function RolesTab() {
	return (
		<SettingsSection
			title="Roles & permissions"
			description="What each role can access across your school portal. This is fixed by the system and can't be edited here."
		>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="sticky left-0 bg-muted/40 px-3 py-2 text-left">Module</th>
							{VISIBLE_ROLES.map((role) => (
								<th key={role} className="px-3 py-2 text-center whitespace-nowrap">
									{ROLE_META[role].label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{VISIBLE_MODULES.map((module) => (
							<tr key={module} className="border-t border-border">
								<td className="sticky left-0 bg-card px-3 py-2.5 font-medium whitespace-nowrap">
									{MODULE_LABELS[module]}
								</td>
								{VISIBLE_ROLES.map((role) => (
									<td key={role} className="px-3 py-2.5 text-center">
										<AccessBadge level={RBAC_MATRIX[module][role]} />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</SettingsSection>
	);
}