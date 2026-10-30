import { z } from "zod";

// ── Send school notification ──────────────────────────────────────────────
export const SendSchoolNotificationDto = z.object({
    title:      z.string().trim().min(1).max(100).refine(t => !/[\r\n]/.test(t), "The title must be one line"),
    message:    z.string().trim().min(1).max(2000),
    type:       z.enum([
                    "event",
                    "holiday",
                    "broadcast",
                    "custom",
                    "fee_reminder",
                ]),
    targetType: z.enum([
                    "STUDENT",
                    "GUARDIAN",
                    "STAFF",
                    "ALL_PARENTS",
                    "ALL_STUDENTS",
                    "ALL_STAFF",
                    "EVERYONE",
                ]),
    channels:   z.array(z.enum(["IN_APP", "EMAIL", "SMS"])).min(1).max(3),
    metadata: z.record(z.string().max(50), z.union([z.string().max(200), z.number(), z.boolean()])).optional().refine(m => !m || Object.keys(m).length <= 10, "At most 10 metadata values"),

    // General (school-wide) messages skip graduates and the families of graduates only; set true to include them.
    includeGraduates: z.boolean().default(false),

    // Specific recipients (optional)
    studentIds:  z.array(z.string().uuid()).max(500).optional(),
    guardianIds: z.array(z.string().uuid()).max(500).optional(),
    staffIds:    z.array(z.string().uuid()).max(500).optional(),
}).strict();

// ── Send platform notification ────────────────────────────────────────────
export const SendPlatformNotificationDto = z.object({
    title:     z.string().trim().min(1).max(100).refine(t => !/[\r\n]/.test(t), "The title must be one line"),
    message:   z.string().trim().min(1).max(2000),
    type:      z.enum([
                   "welcome",
                   "feature_announcement",
                   "subscription_expiry",
                   "subscription_renewed",
                   "subscription_failed",
                   "account_suspended",
                   "account_verified",
                   "account_rejected",
                   "system_alert",
               ]),
    channels:  z.array(z.enum(["IN_APP", "EMAIL", "SMS"])).min(1),
    schoolIds: z.array(z.string().uuid()).optional(), // null = all schools
    metadata: z.record(z.string(), z.any()).optional(),
});

// ── List notifications ────────────────────────────────────────────────────
export const ListNotificationsDto = z.object({
    page:  z.string().optional(),
    limit: z.string().optional(),
    type:  z.string().optional(),
    state: z.string().optional(),
});

export type SendSchoolNotificationDtoType    = z.infer<typeof SendSchoolNotificationDto>;
export type SendPlatformNotificationDtoType  = z.infer<typeof SendPlatformNotificationDto>;
export type ListNotificationsDtoType         = z.infer<typeof ListNotificationsDto>;