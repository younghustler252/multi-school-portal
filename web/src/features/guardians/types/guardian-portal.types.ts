import { GuardianRelation } from "./guardian.types";

export interface MyChildResponseData {
	studentId: string;
	relation: GuardianRelation;
	isPrimary: boolean;
	firstName: string;
	lastName: string;
	photoUrl: string | null;
	isActive: boolean;
}

export interface MyChildrenParams {
	studentId?: string;
	termId?: string;
	page?: number;
	limit?: number;
}

export interface MyChildrenInvoicesParams extends MyChildrenParams {
	status?: string;
}