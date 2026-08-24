export interface PlanFeatures {
	smsNotifications: boolean;
	emailNotifications: boolean;

	reportCardPdf: boolean;
	customGrading: boolean;
	attendanceTracking: boolean;
	gradeManagement: boolean;
	customReportCardTemplate: boolean;

	paymentCollection: boolean;
	feeManagement: boolean;
	paymentReceipts: boolean;

	multipleBranches: boolean;
	prioritySupport: boolean;
	apiAccess: boolean;
	customDomain: boolean;

	parentPortal?: boolean;
	bulkSms?: boolean;
	advancedReports?: boolean;
	whatsappNotifications?: boolean;
}

// Mirrors backend: PlanMapper.toResponse()
export interface PlanResponseData {
	id: string;
	name: string;
	description: string | null;
	studentLimit: number;
	staffLimit: number;
	features: PlanFeatures;
	monthlyPriceKobo: number;
	yearlyPriceKobo: number;
	setupFeeKobo: number;
	isPublic: boolean;
	isActive: boolean;
	isCustom: boolean;
	createdAt: string; // JSON dates arrive as strings, not Date objects
}