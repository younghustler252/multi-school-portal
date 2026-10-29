import { z } from "zod";

// ── Send school notification ──────────────────────────────────────────────
export const SendSchoolNotificationDto = z.object({
    title:      z.string().min(1).max(100),
    message:    z.string().min(1),
    type:       z.enum([
                    "fee_invoice",
                    "fee_reminder",
                    "fee_receipt",
                    "report_card_ready",
                    "attendance_alert",
                    "event",
                    "holiday",
                    "broadcast",
                    "custom",
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
    channels:   z.array(z.enum(["IN_APP", "EMAIL", "SMS"])).min(1),
    metadata: z.record(z.string(), z.any()).optional(),

    // General (school-wide) messages skip graduates and the families of graduates only; set true to include them.
    includeGraduates: z.boolean().default(false),

    // Specific recipients (optional)
    studentIds:  z.array(z.string().uuid()).optional(),
    guardianIds: z.array(z.string().uuid()).optional(),
    staffIds:    z.array(z.string().uuid()).optional(),
});

// ── Send platform notification ────────────────────────────────────────────
export const SendPlatformNotificationDto = z.object({
    title:     z.string().min(1).max(100),
    message:   z.string().min(1),
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