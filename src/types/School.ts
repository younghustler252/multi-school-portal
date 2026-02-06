import { Types } from "mongoose";

/* =======================
   Subscription Plan
======================= */
export enum SubscriptionPlan {
	FREE = "free",
	PREMIUM = "premium",
	ENTERPRISE = "enterprise"
}

/* =======================
   School Type
======================= */
export enum SchoolType {
	PRIVATE = "PRIVATE",
	PUBLIC = "PUBLIC",
	TRAINING_CENTER = "TRAINING_CENTER"
}

/* =======================
   Verification
======================= */
export enum VerificationStatus {
	PENDING = "PENDING",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED"
}

export enum VerificationDocumentType {
	CAC = "CAC",
	MINISTRY_APPROVAL = "MINISTRY_APPROVAL",
	TAX_ID = "TAX_ID",
	ACCREDITATION = "ACCREDITATION",
	OTHER = "OTHER"
}

export interface IVerificationDocument {
    _id: Types.ObjectId;
	documentType: VerificationDocumentType;
	fileUrl: string;
	status: VerificationStatus;
	verifiedAt?: Date;
	verifiedBy?: Types.ObjectId;
	rejectionReason?: string;
}

/* =======================
   Billing
======================= */
export enum BillingStatus {
	TRIAL = "TRIAL",
	ACTIVE = "ACTIVE",
	PAST_DUE = "PAST_DUE",
	CANCELLED = "CANCELLED"
}

export interface IBilling {
	status: BillingStatus;
	provider?: string;
	providerCustomerId?: string;
	lastPaymentAt?: Date;
}

/* =======================
   School Interface
======================= */
export interface ISchool {
	/* Core Identity */
	name: string;
	slug?: string;
	domain?: string;
	schoolType: SchoolType;
	createdBy: Types.ObjectId;
	ownerId: Types.ObjectId;

	/* Contact / Branding */
	address?: string;
	contactEmail?: string;
	logoUrl?: string;
	timezone: string;

	/* Tenant Capabilities */
	features: Map<string, boolean>;

	/* Subscription & Billing */
	subscriptionPlan: SubscriptionPlan;
	billing?: IBilling;

	/* Verification */
	verificationStatus: VerificationStatus;
	verificationDocuments: IVerificationDocument[];

	/* Lifecycle */
	isProfileComplete: boolean;
	isActive: boolean;

	/* Timestamps (from mongoose) */
	createdAt?: Date;
	updatedAt?: Date;
}
