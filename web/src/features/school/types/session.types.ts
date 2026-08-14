export type TermName = "first" | "second" | "third";

export interface TermResponseData {
	id: string;
	sessionId: string;
	name: TermName;
	startDate: string;
	endDate: string;
	isCurrent: boolean;
	createdAt: string;
}

export interface SessionResponseData {
	id: string;
	name: string;
	startDate: string;
	endDate: string;
	isCurrent: boolean;
	createdAt: string;
	terms?: TermResponseData[];
}

export interface CreateSessionDto {
	name: string;
	startDate: string;
	endDate: string;
}

export type UpdateSessionDto = Partial<CreateSessionDto>;

export interface CreateTermDto {
	sessionId: string;
	name: TermName;
	startDate: string;
	endDate: string;
}

export interface UpdateTermDto {
	startDate?: string;
	endDate?: string;
}

export interface CurrentSessionResponseData {
	session: SessionResponseData;
	currentTerm: TermResponseData | null;
}