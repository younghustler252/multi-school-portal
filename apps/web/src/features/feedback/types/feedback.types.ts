export type FeedbackType = "bug" | "suggestion" | "complaint" | "praise";
export type FeedbackStatus = "open" | "reviewed" | "resolved";

export interface SubmitFeedbackDto {
	type: FeedbackType;
	message: string;
	pageUrl?: string;
}

export interface FeedbackResponseData {
	id: string;
	userId: string | null;
	schoolId: string | null;
	type: FeedbackType;
	message: string;
	pageUrl: string | null;
	status: FeedbackStatus;
	response: string | null;
	createdAt: string;
	updatedAt: string;
}