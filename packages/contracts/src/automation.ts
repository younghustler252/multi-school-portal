import { z } from "zod";

export type Channel = "IN_APP" | "EMAIL" | "SMS";
export type Schedule =
    | { type: "daily"; time: string }
    | { type: "weekly"; weekday: number; time: string }
    | { type: "interval"; minutes: number };

/** PATCH /automations/:id (every field optional, at least one) */
export const UpdateAutomationRequest = z.object({
    enabled:  z.boolean().optional(),
    channels: z.array(z.enum(["IN_APP", "EMAIL", "SMS"])).min(1).max(3).optional(),
    params:   z.record(z.string(), z.union([z.boolean(), z.number(), z.string().max(200)])).optional(),
    schedule: z.object({ type: z.enum(["daily", "weekly", "interval"]), weekday: z.number().int().optional(), time: z.string().max(5).optional(), minutes: z.number().int().optional() }).strict().optional(),
}).strict().refine(v => Object.keys(v).length > 0, { message: "Nothing to change" });
export type UpdateAutomationRequest = z.infer<typeof UpdateAutomationRequest>;

export interface AutomationParam { key: string; label: string; description?: string; kind: "boolean" | "integer" | "enum" | "string" | "time"; min?: number; max?: number; default: boolean | number | string; value: boolean | number | string }
export interface Automation {
    id: string; key: string; name: string; description: string; enabled: boolean; channels: Channel[]; templateKey: string;
    schedule: Schedule; scheduleText: string; params: AutomationParam[];
    lastRunAt: string | null; nextRunAt: string | null;
    lastRun: { status: RunStatus; at: string; matched: number; notified: number; skippedReason: string | null } | null;
}
export type RunStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
export interface ChannelAvailability { allowed: Channel[]; blocked: { channel: Channel; reason: "plan" | "school_setting" }[] }
/** GET /automations */
export interface AutomationList { schoolEnabled: boolean; channels: ChannelAvailability; automations: Automation[] }
/** POST /automations/:id/dry-run and /run */
export interface RunReport {
    status: RunStatus; matched: number; people: number; messages: number; created: number; duplicates: number; dryRun: boolean;
    blocked: ChannelAvailability["blocked"]; skippedReason: string | null; error: string | null;
    sample: { channel: Channel; to: string; title: string; message: string }[];
}
export interface RunLog { id: string; ruleId: string; triggeredAt: string; trigger: "SCHEDULE" | "MANUAL"; status: RunStatus; matched: number; notified: number; skippedReason: string | null; error: string | null }
