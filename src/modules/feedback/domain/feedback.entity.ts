import { FeedbackStatus, FeedbackType } from "./feedback.enums";


export interface FeedbackEntity {
    id:        string;
    userId:    string | null;
    schoolId:  string | null;
    type:      FeedbackType;
    message:   string;
    pageUrl:   string | null;
    status:    FeedbackStatus;
    response:  string | null;
    createdAt: Date;
    updatedAt: Date;
}
