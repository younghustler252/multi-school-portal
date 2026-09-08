// src/features/school/types/school-document.types.ts

export type SchoolDocumentType =
	| "cac_certificate"
	| "proprietor_id"
	| "waec_approval"
	| "ministry_approval"
	| "other";

export type IdDocumentType =
	| "nin"
	| "voters_card"
	| "drivers_license"
	| "international_passport"
	| "other";

export type DocumentStatus = "pending" | "approved" | "rejected";

export const DOCUMENT_TYPE_LABELS: Record<SchoolDocumentType, string> = {
	cac_certificate: "CAC Certificate",
	proprietor_id: "Proprietor's ID",
	waec_approval: "WAEC Approval",
	ministry_approval: "Ministry of Education Approval",
	other: "Other Document",
};

export const ID_DOCUMENT_TYPE_LABELS: Record<IdDocumentType, string> = {
	nin: "National ID (NIN)",
	voters_card: "Voter's Card",
	drivers_license: "Driver's License",
	international_passport: "International Passport",
	other: "Other",
};

/**
 * Base required documents for every school.
 */
export const REQUIRED_DOCUMENT_TYPES: SchoolDocumentType[] = [
	"cac_certificate",
	"proprietor_id",
];

export function getRequiredDocumentTypes(
	schoolCategory?: string,
): SchoolDocumentType[] {
	const base: SchoolDocumentType[] = [
		"cac_certificate",
		"proprietor_id",
		"ministry_approval",
	];

	if (
		schoolCategory === "secondary" ||
		schoolCategory === "primary_secondary"
	) {
		return [...base, "waec_approval"];
	}

	return base;
}

export interface SchoolDocumentResponseData {
	id: string;
	schoolId: string;
	type: SchoolDocumentType;
	fileUrl: string;
	status: DocumentStatus;
	rejectionReason: string | null;
	verifiedAt: string | null;
	createdAt: string;
}

export interface UploadDocumentExtraFields {
	idDocumentType?: IdDocumentType;
	idNumber?: string;
	proprietorFullName?: string;
	proprietorDateOfBirth?: string;
}
