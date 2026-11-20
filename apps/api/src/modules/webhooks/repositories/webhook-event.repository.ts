import type { WebhookStatus } from "../domain/webhook.types";

export interface WebhookEventRow {
    id: string; provider: string; eventKey: string; eventType: string; reference: string | null; status: WebhookStatus;
    error: string | null; attempts: number; payload: unknown; receivedAt: Date; processedAt: Date | null; lastAttemptAt: Date | null;
    claimToken?: string | null; claimExpiresAt?: Date | null;
}
export interface WebhookEventFilter { provider?: string; status?: WebhookStatus; reference?: string; type?: string; from?: Date; to?: Date }
/** How long one processor may hold an event before another delivery may take it over (REM-102). */
export const WEBHOOK_LEASE_MS = 5 * 60_000;

/** run = this caller holds the lease (`claimToken`) and must process; otherwise `inProgress` says another processor holds a live lease, else it was already handled. */
export interface BeginResult { row: WebhookEventRow; run: boolean; claimToken: string | null; inProgress: boolean }

export interface IWebhookEventRepository {
    /** Log the event, or find the earlier one with the same key. `run` is false when it was already processed or ignored. */
    begin(input: { provider: string; eventKey: string; eventType: string; reference: string | null; payload: unknown }): Promise<BeginResult>;
    /** Record the outcome. Only the holder of the current lease may; returns false (and writes nothing) when the lease was lost. */
    finish(id: string, claimToken: string, status: "processed" | "ignored" | "failed", error?: string): Promise<boolean>;
    findById(id: string): Promise<WebhookEventRow | null>;
    /** Atomically take a failed (or lease-expired) event for a retry. Returns the lease token, or null when someone else holds it or it is not retryable. */
    claimForRetry(id: string): Promise<string | null>;
    /** FAILED events still under the retry limit, least recently tried first. The caller applies the back-off. */
    findFailedUnderLimit(maxAttempts: number, limit: number): Promise<WebhookEventRow[]>;
    list(filter: WebhookEventFilter, page: number, limit: number): Promise<{ rows: WebhookEventRow[]; total: number }>;
    summary(since: Date): Promise<{ status: WebhookStatus; count: number }[]>;
}
