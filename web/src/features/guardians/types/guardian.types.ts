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