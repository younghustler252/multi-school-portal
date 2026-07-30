export interface SchoolResponseData {
	id: string;
	name: string;
	subdomain: string;
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
	status: string;
	verificationStatus: string;
	isActive: boolean;
	createdAt: string;
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

export interface SchoolDocumentResponseData {
	id: string;
	schoolId: string;
	type: string;
	fileUrl: string;
	status: string;
	rejectionReason: string | null;
	verifiedAt: string | null;
	createdAt: string;
}

export interface ChecklistItem {
	completed: boolean;
	label: string;
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