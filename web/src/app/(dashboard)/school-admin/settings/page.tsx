"use client";

import { useState } from "react";
import {
	Building2,
	GraduationCap,
	CalendarDays,
	CreditCard,
	ShieldCheck,
	WalletCards,
	FileText,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsNav, type SettingsTab } from "@/features/school/components/settings/settings-nav";
import { ProfileTab } from "@/features/school/components/settings/profile-tab";
import { BillingTab } from "@/features/school/components/settings/billing-tab";
import { RolesTab } from "@/features/school/components/settings/roles-tab";
import { CalendarTab } from "@/features/school/components/settings/calendar-tab";
import { GradingConfigTab } from "@/features/grades/components/grading-config-tab";
import { PaymentSetupTab } from "@/features/school/components/settings/payment-stup-tab";
import { ReportCardTemplateTab } from "@/features/school/components/settings/report-card-template-tab";

const TABS: SettingsTab[] = [
	{ id: "profile", label: "School profile", icon: Building2 },
	{ id: "grading", label: "Grading system", icon: GraduationCap },
	{ id: "calendar", label: "Term & calendar", icon: CalendarDays },
	{ id: "billing", label: "Billing & plan", icon: CreditCard },
	{ id: "roles", label: "Roles & permissions", icon: ShieldCheck },
	{ id: "payment", label: "Fee payments", icon: WalletCards },
	{ id: "report-card", label: "Report card", icon: FileText },
];

export default function SchoolSettingsPage() {
	const [activeTab, setActiveTab] = useState("profile");

	return (
		<>
			<PageHeader
				title="Settings"
				description="Manage your school's profile, grading, billing, and fee payments."
			/>

			<div className="space-y-4 lg:grid lg:grid-cols-[220px_1fr] lg:gap-6 lg:space-y-0">
				<SettingsNav
					tabs={TABS}
					active={activeTab}
					onChange={setActiveTab}
				/>

				<div className="space-y-6">
					{activeTab === "profile" && <ProfileTab />}

					{activeTab === "grading" && (
						<GradingConfigTab />
					)}

					{activeTab === "report-card" && (
						<ReportCardTemplateTab />
					)}
					
					{activeTab === "calendar" && (
						<CalendarTab />
					)}

					{activeTab === "billing" && <BillingTab />}

					{activeTab === "roles" && <RolesTab />}

					{activeTab === "payment" && <PaymentSetupTab />}

				</div>
			</div>
		</>
	);
}