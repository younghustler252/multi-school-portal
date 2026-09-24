import { IMapper } from "../../../infrastructure/repository/base.repository";

import { FeedbackEntity } from "../domain/feedback.entity";

import {
    FeedbackStatus,
    FeedbackType,
} from "../domain/feedback.enums";

import {
    EnrichedFeedback,
    FeedbackResponseData,
} from "../types/feedback.types";

export class FeedbackMapper
    implements IMapper<any, FeedbackEntity>
{
    toDomain(raw: any): FeedbackEntity {
        return {
            id: raw.id,
            userId: raw.userId ?? null,
            schoolId: raw.schoolId ?? null,
            type: raw.type as FeedbackType,
            message: raw.message,
            pageUrl: raw.pageUrl ?? null,
            status: raw.status as FeedbackStatus,
            response: raw.response ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }

    toResponse(
        entity: FeedbackEntity,
    ): FeedbackResponseData {
        return {
            id: entity.id,
            userId: entity.userId,
            schoolId: entity.schoolId,
            type: entity.type,
            message: entity.message,
            pageUrl: entity.pageUrl,
            status: entity.status,
            response: entity.response,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }

    toEnrichedResponse(raw: any): EnrichedFeedback {
        return {
            id:         raw.id,
            userId:     raw.userId,
            userName:   raw.user ? `${raw.user.firstName ?? ""} ${raw.user.lastName ?? ""}`.trim() || raw.user.email : null,
            userEmail:  raw.user?.email ?? null,
            schoolId:   raw.schoolId,
            schoolName: raw.school?.name ?? null,
            type:       raw.type,
            message:    raw.message,
            pageUrl:    raw.pageUrl,
            status:     raw.status,
            response:   raw.response,
            createdAt:  raw.createdAt,
            updatedAt:  raw.updatedAt,
        };
    }
}
