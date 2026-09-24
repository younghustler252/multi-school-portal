export type FeedbackType = "bug" | "suggestion" | "complaint" | "praise";
export type FeedbackStatus = "open" | "reviewed" | "resolved";

export interface EnrichedFeedback {
	id: string;
	userId: string | null;
	username: string | null;
	schoolId: string | null;
	schoolName: string | null;
	type: FeedbackType;
	message: string;
	pageUrl: string | null;
	status: FeedbackStatus;
	response: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ListFeedbackParams {
	page?: number;
	limit?: number;
	status?: FeedbackStatus;
	type?: FeedbackType;
}

export interface UpdateFeedbackDto {
	status?: FeedbackStatus;
	response?: string;
}