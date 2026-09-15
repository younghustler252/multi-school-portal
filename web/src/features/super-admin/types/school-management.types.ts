import { PaymentStatus } from "@/features/payments/types/payment.types";
export type SchoolCategory = "primary" | "secondary" | "primary_secondary";
export type SchoolOwnership = "private" | "public" | "mission" | "international";
export type SchoolStatus = "pending" | "active" | "suspended" | "deactivated";
export type VerificationStatus = "unverified" | "under_review" | "verified" | "rejected";

export interface AdminSchoolResponseData {
	id: string;
	name: string;
	subdomain: string;
	email: string;
	phone: string | null;
	schoolCategory: SchoolCategory;
	schoolOwnership: SchoolOwnership;
	status: SchoolStatus;
	verificationStatus: VerificationStatus;
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


export interface BillingHistoryEntry {
	id: string;
	subscriptionId: string;
	amountKobo: number;
	status: PaymentStatus;
	billingCycle: "monthly" | "yearly";
	paystackReference: string | null;
	paidAt: string | null;
	failureReason: string | null;
	createdAt: string;
}
