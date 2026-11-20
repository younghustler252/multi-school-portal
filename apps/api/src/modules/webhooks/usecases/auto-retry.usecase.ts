import type { IWebhookEventRepository, WebhookEventRow } from "../repositories/webhook-event.repository";
import type { WebhookEnvelope } from "../domain/webhook.types";
import type { WebhookProcessor } from "../services/webhook-processor.service";
import { ActorType } from "../../audit/domain/audit.enums";

/*
|--------------------------------------------------------------------------
| AUTOMATIC WEBHOOK RETRY (REM-103)
| A FAILED event used to wait for a person to press "retry". Now a job runs this every minute:
|   - an event is retried when its back-off has passed: 2, 4, 8, 16 ... minutes after its last attempt (at most 6 hours);
|   - at most MAX_ATTEMPTS attempts in all (the first delivery counts as one). After the last failed attempt the event is "dead":
|     it stays FAILED for the manual retry button, and an alert is raised once (`alert`), so it is not forgotten;
|   - every retry takes the same lease as a manual one (claimForRetry), so a person pressing retry at the same time, or two
|     job runs, never process the same event twice; handlers are idempotent per event key.
|--------------------------------------------------------------------------
*/
export const WEBHOOK_MAX_ATTEMPTS = 6;
export const WEBHOOK_RETRY_BATCH = 50;

/** Wait before attempt number `attemptsSoFar + 1`: 2^attempts minutes, never more than 6 hours. */
export const webhookBackoffMs = (attemptsSoFar: number): number => Math.min(2 ** Math.max(1, attemptsSoFar), 360) * 60_000;

export const webhookDue = (r: Pick<WebhookEventRow, "attempts" | "lastAttemptAt" | "receivedAt">, now: Date): boolean =>
    now.getTime() - (r.lastAttemptAt ?? r.receivedAt).getTime() >= webhookBackoffMs(r.attempts);

interface Dependencies {
    webhookEventRepository: IWebhookEventRepository;
    webhookProcessor: WebhookProcessor;
    auditService: { log(p: any): Promise<void> };
}
interface Options { now?: () => Date; alert?: (message: string, context: Record<string, unknown>) => void }

export interface AutoRetrySummary { tried: number; processed: number; ignored: number; failed: number; dead: number; skipped: number }

export class AutoRetryWebhooksUseCase {
    private readonly now: () => Date;
    private readonly alert: (message: string, context: Record<string, unknown>) => void;
    constructor(private readonly d: Dependencies, options: Options = {}) {
        this.now = options.now ?? (() => new Date());
        this.alert = options.alert ?? ((message, context) => {
            console.error(`🚨 ${message}`, JSON.stringify(context));
            try { (require("@sentry/node") as typeof import("@sentry/node")).captureMessage(message, { level: "error", extra: context }); } catch { /* monitoring must not break the job */ }
        });
    }

    async execute(): Promise<AutoRetrySummary> {
        const out: AutoRetrySummary = { tried: 0, processed: 0, ignored: 0, failed: 0, dead: 0, skipped: 0 };
        const now = this.now();
        const candidates = (await this.d.webhookEventRepository.findFailedUnderLimit(WEBHOOK_MAX_ATTEMPTS, 200)).filter(r => webhookDue(r, now)).slice(0, WEBHOOK_RETRY_BATCH);

        for (const row of candidates) {
            const stored = row.payload as { data?: Record<string, any> } | null;
            if (!stored?.data) { out.skipped++; continue; }                       // nothing to replay: a person has to look at it
            const token = await this.d.webhookEventRepository.claimForRetry(row.id);
            if (!token) { out.skipped++; continue; }                              // someone else (a person, another run) has it
            out.tried++;
            const event: WebhookEnvelope = { provider: row.provider, type: row.eventType, eventKey: row.eventKey, reference: row.reference, data: stored.data };
            let processed = false, failed = false, error: string | undefined;
            try { const r = await this.d.webhookProcessor.process(row.id, token, event); processed = r.processed; failed = !!r.failed; error = r.error; }
            catch (e) { failed = true; error = (e as Error).message; }            // a crash leaves the lease to expire; the next run takes over
            const attempts = (await this.d.webhookEventRepository.findById(row.id))?.attempts ?? row.attempts + 1;   // the count after this attempt, as stored
            if (processed) out.processed++; else if (failed) out.failed++; else out.ignored++;   // "ignored" is a final outcome, not a failure
            const dead = failed && attempts >= WEBHOOK_MAX_ATTEMPTS;
            if (dead) {
                out.dead++;
                this.alert(`Webhook event ${row.id} (${row.provider} ${row.eventType}) failed ${attempts} times and will not be retried automatically`, { id: row.id, provider: row.provider, type: row.eventType, reference: row.reference, error: error ?? null });
            }
            await this.d.auditService.log({
                userId: "SYSTEM_WEBHOOK_RETRY", actorType: ActorType.SYSTEM, action: dead ? "webhook.dead" : "webhook.auto_retried", entity: "WebhookEvent", entityId: row.id, module: "webhooks",
                newValue: { type: row.eventType, reference: row.reference, attempts, processed, error: error ?? null },
            }).catch(() => undefined);
        }
        return out;
    }
}
