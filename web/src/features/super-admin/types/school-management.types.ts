export type SchoolCategory = "primary" | "secondary" | "primary_secondary";
export type SchoolOwnership = "private" | "public" | "mission" | "international";
export interface AdminSchoolResponseData {
	id: string;
	name: string;
	subdomain: string;
	email: string;
	phone: string | null;
	schoolCategory: SchoolCategory;
	schoolOwnership: SchoolOwnership;
	status: string;
	verificationStatus: string;
	isActive: boolean;
	createdAt: string;
	planName: string | null;
	studentCount: number;
	mrrKobo: number;
}

export interface ListSchoolsParams {
	page?: number;
	limit?: number;
	status?: string;
	verificationStatus?: string;
	search?: string;
}

export interface RejectSchoolDto {
	schoolId: string;
	reason: string;
}

export interface SuspendSchoolDto {
	schoolId: string;
	reason: string;
}

export interface RejectDocumentDto {
	documentId: string;
	reason: string;
}