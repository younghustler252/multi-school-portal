import { StudentResponseData } from "@/features/students/types/student.types";


export type GuardianRelation =
	| "father" | "mother" | "uncle" | "aunt"
	| "grandparent" | "sibling" | "guardian" | "other";


export interface GuardianResponseData {
	id: string;
	userId: string | null;
	firstName: string;
	lastName: string;
	email: string;
	phone: string | null;
	occupation: string | null;
	address: string | null;
	isActive: boolean;
	createdAt: string;
}

export interface CreateGuardianDto {
	firstName: string;
	lastName: string;
	email: string;
	phone?: string;
	occupation?: string;
	address?: string;

	studentId: string;
	relation: GuardianRelation;
	isPrimary: boolean;
}

export interface UpdateGuardianDto {
	firstName?: string;
	lastName?: string;
	email?: string;
	phone?: string;
	occupation?: string;
	address?: string;
}

export interface LinkGuardianDto {
	studentId: string;
	relation: GuardianRelation;
	isPrimary: boolean;
}

export interface ListGuardiansParams {
	page?: number;
	limit?: number;
	studentId?: string;
	search?: string;
}


export interface GuardianStudentLinkResponseData extends StudentResponseData {
	relation: GuardianRelation;
	isPrimary: boolean;
}

export interface GuardianWithStudentsResponseData extends GuardianResponseData {
	students: GuardianStudentLinkResponseData[];
}


export type BulkInviteStatus = "sent" | "skipped" | "failed";

export interface BulkInviteResultItem {
	guardianId: string;
	status: BulkInviteStatus;
	reason?: string;
}

export interface BulkInviteGuardiansResult {
	sent: number;
	skipped: number;
	failed: number;
	results: BulkInviteResultItem[];
}