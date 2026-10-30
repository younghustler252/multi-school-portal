import { FeedbackEntity } from "../domain/feedback.entity";
import {
    FeedbackStatus,
    FeedbackType,
} from "../domain/feedback.enums";
import { EnrichedFeedback } from "../types/feedback.types";

import type {
    PaginatedResult,
} from "../../../infrastructure/repository/base.repository";

export interface IFeedbackRepository {
    // ── Base CRUD ─────────────────────────────────────────────────────────

    findById(
        id: string,
    ): Promise<FeedbackEntity | null>;

    create(data: {
        userId?: string | null;
        schoolId?: string | null;
        type: FeedbackType;
        message: string;
        pageUrl?: string | null;
    }): Promise<FeedbackEntity>;

    update(
        id: string,
        data: Record<string, any>,
    ): Promise<FeedbackEntity>;

    delete(
        id: string,
    ): Promise<FeedbackEntity>;

    // ── Feedback queries ─────────────────────────────────────────────────

    findByUserId(
        userId: string,
    ): Promise<FeedbackEntity[]>;

    findBySchoolId(
        schoolId: string,
    ): Promise<FeedbackEntity[]>;

    // ── Enriched queries ─────────────────────────────────────────────────

    findByIdEnriched(
        id: string,
    ): Promise<EnrichedFeedback | null>;

    findManyEnriched(
        where?: Record<string, any>,
        orderBy?: Record<string, any>,
    ): Promise<EnrichedFeedback[]>;

    paginateEnriched(params: {
        page?: number;
        limit?: number;
        where?: Record<string, any>;
        orderBy?: Record<string, any>;
    }): Promise<PaginatedResult<EnrichedFeedback>>;

    // ── Feedback actions ─────────────────────────────────────────────────

    updateStatus(
        id: string,
        status: FeedbackStatus,
    ): Promise<FeedbackEntity>;

    respond(
        id: string,
        response: string,
        status?: FeedbackStatus,
    ): Promise<FeedbackEntity>;
}
