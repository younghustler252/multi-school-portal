export type DocumentType = "cac_certificate" | "proprietor_id" | "waec_approval" | "ministry_approval" | "other";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
	cac_certificate: "CAC Certificate",
	proprietor_id: "Proprietor's ID",
	waec_approval: "WAEC Approval",
	ministry_approval: "Ministry of Education Approval",
	other: "Other Document",
};

export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
	"cac_certificate",
	"proprietor_id",
];


export type DocumentStatus = "pending" | "approved" | "rejected";

export interface SchoolDocumentResponseData {
	id: string;
	schoolId: string;
	type: DocumentType;
	fileUrl: string;
	status: DocumentStatus;
	rejectionReason: string | null;
	verifiedAt: string | null;
	createdAt: string;
}