export type SchoolStatus = "pending" | "active" | "suspended";
export type VerificationStatus = "unverified" | "under_review" | "verified" | "rejected";

export interface SchoolStatusFields {
	id: string;
	name: string;
	subdomain: string;
	status: SchoolStatus;
	isActive: boolean;
	verificationStatus: VerificationStatus;
}


export interface SchoolResponseData extends SchoolStatusFields {
	email: string;
	phone: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	country: string;
	timezone: string;
	logoUrl: string | null;
	schoolCategory: string;
	schoolOwnership: string;
	paymentSetupComplete: boolean;
	paystackSubaccountCode: string | null;
	settlementBankCode: string | null;
	settlementAccountNumberMasked: string | null;
	createdAt: string;
}

export interface PublicSchoolInfo extends SchoolStatusFields {
	logoUrl: string | null;
	schoolCategory: string;
	primaryColor: string | null;
	secondaryColor: string | null;
	motto: string | null;
	website: string | null;
	principalName: string | null;
	address: string | null;
}


export interface UpdateSchoolDto {
	name?: string;
	email?: string;
	phone?: string;
	address?: string;
	city?: string;
	state?: string;
	country?: string;
	timezone?: string;
	schoolCategory?: "primary" | "secondary" | "primary_secondary";
	schoolOwnership?: "private" | "public" | "mission" | "international";
}

export interface ChecklistItem {
	completed: boolean;
	label: string;
}
export interface SetupPaymentDto {
	bankCode: string;
	accountNumber: string;
}
export interface SetupChecklist {
	schoolProfile: ChecklistItem;
	logoUploaded: ChecklistItem;
	documentsUploaded: ChecklistItem;
	paymentSetup: ChecklistItem;
	gradingConfigured: ChecklistItem;
	staffAdded: ChecklistItem;
	studentsAdded: ChecklistItem;
	classesSetup: ChecklistItem;
	firstEnrolment: ChecklistItem;
	completionPercent: number;
}

export interface UploadFileResponseData {
	url: string;
}


/**
 * GET /school/dashboard. Mirrors `SchoolDashboard` in apps/api/src/modules/school/usecases/get-dashboard.usecase.ts.
 * Each section except `school` and `plan` is null when the viewer's role does not allow it (a bursar never receives
 * student data), so the UI must render only the sections that are present.
 */
export interface SchoolDashboardData {
	school: {
		name: string;
		status: string;
		verificationStatus: string;
	};
	plan: {
		name: string;
		status: string;
		expiresAt: string | null;
		/** null = unlimited. */
		studentLimit: number | null;
		/** null = unlimited. */
		staffLimit: number | null;
	};
	people: {
		totalStaff: number;
		activeStaff: number;
		totalStudents: number;
		activeStudents: number;
		totalGuardians: number;
	} | null;
	academics: {
		currentTerm: string | null;
		totalClasses: number;
		totalSubjects: number;
		activeEnrolments: number;
	} | null;
	fees: {
		/** Current term label, null when no term is current. */
		term: string | null;
		totalInvoicedKobo: number;
		totalCollectedKobo: number;
		totalPendingKobo: number;
		overdueInvoices: number;
	} | null;
	attendance: {
		/** The school's own calendar day, YYYY-MM-DD. */
		date: string;
		present: number;
		absent: number;
		late: number;
		excused: number;
	} | null;
}
