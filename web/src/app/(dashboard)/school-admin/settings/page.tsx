"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";

const TABS: SettingsTab[] = [
	{ id: "profile", label: "School profile", icon: Building2 },
	{ id: "grading", label: "Grading system", icon: GraduationCap },
	{ id: "calendar", label: "Term & calendar", icon: CalendarDays },
	{ id: "billing", label: "Billing & plan", icon: CreditCard },
	{ id: "roles", label: "Roles & permissions", icon: ShieldCheck },
	{ id: "payment", label: "Fee payments", icon: WalletCards },
	{ id: "report-card", label: "Report card", icon: FileText },
];

const DEFAULT_TAB = "profile";
const VALID_TAB_IDS = TABS.map((t) => t.id);

export default function SchoolSettingsPage() {
	return (
		// useSearchParams requires a Suspense boundary for this to be
		// statically optimizable — harmless either way, but Next warns without it
		<Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
			<SchoolSettingsContent />
		</Suspense>
	);
}

function SchoolSettingsContent() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const tabParam = searchParams.get("tab");
	const activeTab = tabParam && VALID_TAB_IDS.includes(tabParam) ? tabParam : DEFAULT_TAB;

	function setActiveTab(tab: string) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", tab);
		// drop any leftover payment-callback params when the user manually switches tabs
		params.delete("reference");
		params.delete("trxref");
		router.replace(`${pathname}?${params.toString()}`, { scroll: false });
	}

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
					{activeTab === "grading" && <GradingConfigTab />}
					{activeTab === "report-card" && <ReportCardTemplateTab />}
					{activeTab === "calendar" && <CalendarTab />}
					{activeTab === "billing" && <BillingTab />}
					{activeTab === "roles" && <RolesTab />}
					{activeTab === "payment" && <PaymentSetupTab />}
				</div>
			</div>
		</>
	);
}