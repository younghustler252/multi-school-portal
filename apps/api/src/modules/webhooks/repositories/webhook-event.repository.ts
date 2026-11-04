import type { WebhookStatus } from "../domain/webhook.types";

export interface WebhookEventRow {
    id: string; provider: string; eventKey: string; eventType: string; reference: string | null; status: WebhookStatus;
    error: string | null; attempts: number; payload: unknown; receivedAt: Date; processedAt: Date | null; lastAttemptAt: Date | null;
}
export interface WebhookEventFilter { provider?: string; status?: WebhookStatus; reference?: string; type?: string; from?: Date; to?: Date }
export interface BeginResult { row: WebhookEventRow; /** false = this event was already handled (or is being handled) */ run: boolean }

export interface IWebhookEventRepository {
    /** Log the event, or find the earlier one with the same key. `run` is false when it was already processed or ignored. */
    begin(input: { provider: string; eventKey: string; eventType: string; reference: string | null; payload: unknown }): Promise<BeginResult>;
    finish(id: string, status: "processed" | "ignored" | "failed", error?: string): Promise<void>;
    findById(id: string): Promise<WebhookEventRow | null>;
    /** Atomically take a failed event for a retry. False when someone else already took it or it is no longer failed. */
    claimForRetry(id: string): Promise<boolean>;
    list(filter: WebhookEventFilter, page: number, limit: number): Promise<{ rows: WebhookEventRow[]; total: number }>;
    summary(since: Date): Promise<{ status: WebhookStatus; count: number }[]>;
}
