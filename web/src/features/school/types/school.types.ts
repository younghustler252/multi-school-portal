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
	paystackSubaccountCode: string | null;
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


export interface SchoolDashboardData {
	school: {
		name: string;
		status: string;
		verificationStatus: string;
	};
	plan: {
		name: string;
		studentLimit: number;
		staffLimit: number;
		status: string;
		expiresAt: string | null;
	};
	people: {
		totalStaff: number;
		activeStaff: number;
		totalStudents: number;
		activeStudents: number;
		totalGuardians: number;
	};
	academics: {
		totalClasses: number;
		totalSubjects: number;
		totalEnrolments: number;
	};
	fees: {
		totalInvoiced: number; // kobo
		totalCollected: number; // kobo
		totalPending: number; // kobo
		defaulters: number;
	};
	attendance: {
		todayPresent: number;
		todayAbsent: number;
		todayLate: number;
	};
}