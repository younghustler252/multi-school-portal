import { z } from "zod";

import {
    FeedbackStatus,
    FeedbackType,
} from "../domain/feedback.enums";

// ── Submit feedback ───────────────────────────────────────────────────────

export const SubmitFeedbackDto = z.object({
    type: z.enum([
        FeedbackType.BUG,
        FeedbackType.SUGGESTION,
        FeedbackType.COMPLAINT,
        FeedbackType.PRAISE,
    ]),

    message: z
        .string()
        .trim()
        .min(1, "Feedback message is required")
        .max(5000),

    pageUrl: z
        .string()
        .trim()
        .max(2048)
        .optional(),
});

// ── Update feedback status ───────────────────────────────────────────────

export const UpdateFeedbackStatusDto = z.object({
    status: z.enum([
        FeedbackStatus.OPEN,
        FeedbackStatus.REVIEWED,
        FeedbackStatus.RESOLVED,
    ]),
});

// ── Respond to feedback ──────────────────────────────────────────────────

export const RespondToFeedbackDto = z.object({
    response: z
        .string()
        .trim()
        .min(1, "Response is required")
        .max(5000),

    status: z
        .enum([
            FeedbackStatus.OPEN,
            FeedbackStatus.REVIEWED,
            FeedbackStatus.RESOLVED,
        ])
        .optional(),
});

// ── List feedback ────────────────────────────────────────────────────────

export const ListFeedbackDto = z.object({
    page: z.coerce
        .number()
        .int()
        .positive()
        .default(1),

    limit: z.coerce
        .number()
        .int()
        .positive()
        .max(100)
        .default(20),

    type: z
        .enum([
            FeedbackType.BUG,
            FeedbackType.SUGGESTION,
            FeedbackType.COMPLAINT,
            FeedbackType.PRAISE,
        ])
        .optional(),

    status: z
        .enum([
            FeedbackStatus.OPEN,
            FeedbackStatus.REVIEWED,
            FeedbackStatus.RESOLVED,
        ])
        .optional(),

    userId: z.string().uuid().optional(),

    schoolId: z.string().uuid().optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────

export type SubmitFeedbackDtoType =
    z.infer<typeof SubmitFeedbackDto>;

export type UpdateFeedbackStatusDtoType =
    z.infer<typeof UpdateFeedbackStatusDto>;

export type RespondToFeedbackDtoType =
    z.infer<typeof RespondToFeedbackDto>;

export type ListFeedbackDtoType =
    z.infer<typeof ListFeedbackDto>;
