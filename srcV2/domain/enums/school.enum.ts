// domain/school/school.enums.ts

// ==============================
// 🏫 School Type
// ==============================

export enum SchoolType {
	PRIMARY = "PRIMARY",
	SECONDARY = "SECONDARY",
	HIGH_SCHOOL = "HIGH_SCHOOL",
	COLLEGE = "COLLEGE",
	UNIVERSITY = "UNIVERSITY",
	VOCATIONAL = "VOCATIONAL",
	OTHER = "OTHER"
}

// ==============================
// 💳 Subscription Plan
// ==============================

export enum SubscriptionPlan {
	FREE = "FREE",
	BASIC = "BASIC",
	PRO = "PRO",
	ENTERPRISE = "ENTERPRISE"
}

// ==============================
// 🧾 Billing Status
// ==============================

export enum BillingStatus {
	TRIAL = "TRIAL",
	ACTIVE = "ACTIVE",
	PAST_DUE = "PAST_DUE",
	CANCELED = "CANCELED",
	SUSPENDED = "SUSPENDED"
}

// ==============================
// 🔎 Verification Status
// ==============================

export enum VerificationStatus {
	PENDING = "PENDING",
	UNDER_REVIEW = "UNDER_REVIEW",
	APPROVED = "APPROVED",
	REJECTED = "REJECTED"
}

// ==============================
// 📄 Verification Document Type
// ==============================

export enum VerificationDocumentType {
	REGISTRATION_CERTIFICATE = "REGISTRATION_CERTIFICATE",
	ACCREDITATION_CERTIFICATE = "ACCREDITATION_CERTIFICATE",
	GOVERNMENT_APPROVAL = "GOVERNMENT_APPROVAL",
	TAX_IDENTIFICATION = "TAX_IDENTIFICATION",
	OTHER = "OTHER"
}