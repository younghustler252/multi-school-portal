"use client";

import { useState } from "react";
import { Building2, GraduationCap, CalendarDays, CreditCard, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsNav, type SettingsTab } from "@/components/school-admin/settings/settings-nav";
import { ComingSoonTab } from "@/components/school-admin/settings/coming-soon-tab";
import { ProfileTab } from "@/components/school-admin/settings/profile-tab";
import { BillingTab } from "@/components/school-admin/settings/billing-tab";
import { RolesTab } from "@/components/school-admin/settings/roles-tab";

const TABS: SettingsTab[] = [
	{ id: "profile", label: "School profile", icon: Building2 },
	{ id: "grading", label: "Grading system", icon: GraduationCap },
	{ id: "calendar", label: "Term & calendar", icon: CalendarDays },
	{ id: "billing", label: "Billing & plan", icon: CreditCard },
	{ id: "roles", label: "Roles & permissions", icon: ShieldCheck },
];

export default function SchoolSettingsPage() {
	const [activeTab, setActiveTab] = useState("profile");

	return (
		<>
			<PageHeader title="Settings" description="Manage your school's profile, grading and billing." />

			<div className="space-y-4 lg:grid lg:grid-cols-[220px_1fr] lg:gap-6 lg:space-y-0">
				<SettingsNav tabs={TABS} active={activeTab} onChange={setActiveTab} />

				<div className="space-y-6">
					{activeTab === "profile" && <ProfileTab />}
					{activeTab === "grading" && (
						<ComingSoonTab title="Grading system" description="Configure CA/exam weights and grade bands for your school." />
					)}
					{activeTab === "calendar" && (
						<ComingSoonTab title="Term & calendar" description="Set up your academic sessions, terms, and holidays." />
					)}
					{activeTab === "billing" && <BillingTab />}
					{activeTab === "roles" && <RolesTab />}
				</div>
			</div>
		</>
	);
}