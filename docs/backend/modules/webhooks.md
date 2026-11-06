# Webhooks Module

> **Source snapshot:** refactor/modules, reviewed 2026-11-06. This guide documents the provider webhook front door, Paystack signature validation, durable event log, handler registry and platform retry console. Test sources were inspected but not executed.

## Responsibility and boundaries

Webhooks owns the external event boundary:
- Provider-specific signature validation and payload normalization.
- Raw-body handling and provider rate limiting.
- Stable provider/event key and slim safe payload persistence.
- Exactly-one-handler routing.
- Event status/attempt history and failure reason.
- Platform event search/summary/manual retry.

Business modules own event effects:
- Fee payment confirmation: Payments.
- Subscription invoice reconciliation: Subscriptions.
- Salary transfer outcomes: Payroll Transfers.

The webhook front door must not duplicate business rules; it passes a normalized WebhookEnvelope to exactly one registered handler.

## Runtime composition and route mounts

Provider endpoint: /api/v1/webhooks/:provider

Platform console: /api/v1/platform/webhooks

The provider endpoint is unauthenticated by user session because the provider cannot log in; it requires a valid provider signature. It uses a rate limiter and raw application/json body parser before the global JSON parser. The raw body is passed to the provider adapter for signature verification.

Platform routes require platform.webhooks.view or platform.webhooks.retry. Retry permission is sensitive and platform-realm only.

## HTTP endpoints

### Provider front door — base /api/v1/webhooks

| Method | Path | Authentication | Behavior |
|---|---|---|---|
| POST | /:provider | Provider signature | Verify, normalize, persist and process one event |

Unknown provider, missing/bad signature, invalid JSON or malformed envelope is rejected before event persistence. Provider adapter currently registered: Paystack.

### Platform console — base /api/v1/platform/webhooks

| Method | Path | Permission | Behavior |
|---|---|---|---|
| GET | /events | platform.webhooks.view | Paginated event list/filter |
| GET | /summary | platform.webhooks.view | Status counts over selected time window |
| POST | /events/:id/retry | platform.webhooks.retry | Manually retry a FAILED event |

List filters include status, provider, event type, reference, from/to, page and limit. Limit is bounded; summary window is bounded to 720 hours.

## Paystack adapter and signature verification

PaystackWebhookProvider:
- Verifies X-Paystack-Signature using the configured payment provider's webhook signature verifier.
- Parses JSON and requires an event type.
- Builds eventKey as type plus data.id, falling back to reference, then "none".
- Exposes normalized provider/type/eventKey/reference/data.
- Stores only a slim payload with id, reference, status, amount, currency, transfer_code, reason, paid_at and allowlisted metadata keys type, schoolId, paymentId and invoiceId.
- Customer, card authorization, recipient account details and unrelated metadata are deliberately discarded before persistence.

The signature is computed over the raw request body. Do not parse/re-stringify the JSON before verification.

## Event processing and handler ownership

WebhookProcessor queries the dynamic registry of all registered handler classes:
- Zero handlers: event is marked IGNORED.
- More than one handler: event is marked FAILED as a wiring error; no handler runs.
- Exactly one handler: invoke it and mark PROCESSED or FAILED with bounded error text.

Current ownership:
- charge.success with metadata.type=subscription_invoice → Subscriptions.
- charge.success with school fee metadata → Payments.
- charge.success without fee/subscription metadata but with reference is currently claimed by the fee handler and fails clearly if school metadata is missing.
- transfer.success/failed/reversed with a salary-transfer reference → Payroll Transfers.
- Unrelated event types/references are ignored.

Fee payment handling resolves the school from provider metadata, requires a provisioned tenant schema, enters tenant context and calls the payment confirmation use case. Subscription handling reconciles the invoice by provider reference. Salary transfer handling derives the school from the transfer reference prefix and applies the shared transfer outcome service.

## Event idempotency and retry

Public WebhookEvent is unique by provider + eventKey. Event states: received, processed, ignored and failed.

Receive flow:
1. Resolve provider and verify signature over raw body.
2. Parse and slim payload.
3. Begin event record. New event starts received with attempts=1.
4. If event already processed/ignored, return duplicate without running handler.
5. If no handler claims event, mark ignored.
6. If exactly one handler claims, process it.
7. On success mark processed; on error mark failed with error text.
8. Return a normal provider response even when handler failed; failed event remains available for platform manual retry.

Retry console only permits FAILED events with stored payload. It atomically claims failed→received, increments attempts and invokes the same processor. Retry is audited with admin ID.

The repository currently also treats status=received as claimable when the same provider/eventKey is delivered again. There is no lease/owner token or stale-received threshold; see REM-102.

## Operational behavior

A failed handler event is acknowledged to the provider rather than asking it to retry. The stored event must be retried manually from the platform console; there is no automatic retry scheduler/queue for failed WebhookEvent rows. The design avoids provider retry storms but makes the platform team responsible for discovering and retrying failures.

The event log stores only normalized allowlisted fields, not the raw body. If the provider later changes its payload shape, a manually retried event can only use the fields captured at original receipt time.

## Persistence

Public model WebhookEvent stores provider, eventKey, event type, reference, slim JSON payload, status, attempts, error, receivedAt, processedAt and lastAttemptAt. Unique provider/eventKey prevents duplicate event rows. Public storage permits the platform console to inspect failures across schools.

No raw card/customer/bank details should be added to the slim payload without a security/privacy review.

## Tests and verification status

Test sources inspected:
- apps/api/tests/webhooks/webhooks.test.ts
- apps/api/tests/webhooks/webhooks.wiring.test.ts

Coverage includes bad signature/body/provider, duplicate processed event, ignored events, multiple handler conflict, handler failure and provider retry, slim payload privacy, manual retry/claim, summary counts, handler ownership, registry discovery, permission registry and DTO bounds.

The in-memory repository intentionally mirrors the real begin behavior, including allowing received events to be claimed again. Tests do not cover simultaneous duplicate deliveries, real raw-body HTTP signature verification, public DB uniqueness/locking, rate limiter behavior or real provider payloads.

Not executed: tests, typecheck, build, migrations, live HTTP request, Paystack sandbox webhook or concurrent event delivery.

## Open implementation and verification items

1. **Concurrent duplicate deliveries can both claim a received event.** begin treats failed OR received as claimable and leaves status received after claiming; two concurrent duplicate requests can both update and run the same handler. Add a lease/claim token and stale-received timeout, or transition to a distinct PROCESSING state with compare-and-swap. See REM-102.
2. **Failed webhook events have no automatic retry.** The endpoint acknowledges failure and only platform manual retry can recover it. Add bounded backoff retries through a durable worker/cron, with dead-letter/manual review after a maximum. If manual-only is deliberate, add alerts/SLOs so failures cannot remain unnoticed. See REM-103.
3. **No HTTP/real-DB concurrency tests were found.** Add tests for raw-body signature verification, concurrent duplicate delivery, event unique index, claim lease, manual retry, platform permissions and tenant handler routing. See REM-104.
4. **Event key fallback "type:none" collapses same-type events without ID/reference.** Such events are not actionable by current handlers, but should be rejected/ignored without persisting a shared collision key or assigned a deterministic payload hash. See REM-105.
5. **Run webhook tests, typecheck/build and provider sandbox verification** before production webhooks are enabled.

## Source paths reviewed

- apps/api/src/modules/webhooks/routes/webhook.routes.ts
- apps/api/src/modules/webhooks/controllers/webhook.controller.ts
- apps/api/src/modules/webhooks/dtos/webhook.dto.ts
- apps/api/src/modules/webhooks/domain/webhook.types.ts
- apps/api/src/modules/webhooks/providers/paystack.webhook-provider.ts
- apps/api/src/modules/webhooks/services/webhook-processor.service.ts
- apps/api/src/modules/webhooks/repositories/webhook-event.repository.impl.ts
- apps/api/src/modules/webhooks/usecases/webhook.usecases.ts
- apps/api/src/modules/webhooks/webhooks.registry.ts
- apps/api/src/modules/webhooks/webhooks.permissions.ts
- apps/api/src/modules/webhooks/webhooks.container.ts
- apps/api/src/modules/payments/webhooks/fee-payment.webhook-handler.ts
- apps/api/src/modules/subscriptions/webhooks/subscription.webhook-handler.ts
- apps/api/src/modules/payroll-transfers/webhooks/transfer.webhook-handler.ts
- apps/api/src/routes/index.ts
- apps/api/prisma/public.prisma
- apps/api/tests/webhooks/webhooks.test.ts
- apps/api/tests/webhooks/webhooks.wiring.test.ts
