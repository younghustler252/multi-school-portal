import {
    FeedbackStatus,
    FeedbackType,
} from "../domain/feedback.enums";

export interface FeedbackResponseData {
    id: string;
    userId: string | null;
    schoolId: string | null;
    type: FeedbackType;
    message: string;
    pageUrl: string | null;
    status: FeedbackStatus;
    response: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface EnrichedFeedback {
    id:          string;
    userId:      string | null;
    userName:    string | null; // computed from firstName + lastName, or null if anonymous/no user
    userEmail:   string | null;
    schoolId:    string | null;
    schoolName:  string | null;
    type:        FeedbackType;
    message:     string;
    pageUrl:     string | null;
    status:      FeedbackStatus;
    response:    string | null;
    createdAt:   Date;
    updatedAt:   Date;
}