import { PlanFeatures } from "../types/plan.types";

export interface FeatureRow {
	key: keyof PlanFeatures;
	label: string;
}

export interface FeatureGroup {
	label: string;
	rows: FeatureRow[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
	{
		label: "Communication",
		rows: [
			{ key: "emailNotifications", label: "Email notifications" },
			{ key: "smsNotifications", label: "SMS notifications" },
			{ key: "whatsappNotifications", label: "WhatsApp notifications" },
			{ key: "bulkSms", label: "Bulk SMS" },
		],
	},
	{
		label: "Academic",
		rows: [
			{ key: "attendanceTracking", label: "Attendance tracking" },
			{ key: "gradeManagement", label: "Grade management" },
			{ key: "reportCardPdf", label: "PDF report cards" },
			{ key: "customGrading", label: "Custom grading scale" },
			{ key: "advancedReports", label: "Advanced reports" },
		],
	},
	{
		label: "Finance",
		rows: [
			{ key: "feeManagement", label: "Fee management" },
			{ key: "paymentCollection", label: "Online payment collection" },
			{ key: "paymentReceipts", label: "Payment receipts" },
		],
	},
	{
		label: "Platform",
		rows: [
			{ key: "parentPortal", label: "Parent portal" },
			{ key: "multipleBranches", label: "Multiple branches" },
			{ key: "prioritySupport", label: "Priority support" },
			{ key: "apiAccess", label: "API access" },
			{ key: "customDomain", label: "Custom domain" },
		],
	},
];