# Webhooks module

Provider events (Paystack today) come in through one front door, `modules/webhooks`. It knows nothing about money: it checks the signature, logs the event, handles each event once, and hands it to the module that owns its meaning.

## Flow
1. `POST /api/v1/webhooks/:provider` (for example `/webhooks/paystack`). Mounted in `app.ts` BEFORE the global rate limit and the JSON parser: it has its own higher limit (`webhookLimiter`, 1000 per minute) and keeps the raw body, because the signature is checked on the exact bytes. (Before, the 100-per-15-minutes global limit applied to webhooks too.)
2. Unknown provider: 404. Bad signature: 401. Body that is not JSON: 400. Nothing is logged for these.
3. The event is written to `WebhookEvent` (table in the public schema) with only the fields a handler needs (`PaystackWebhookProvider.slim`: id, reference, status, amount, currency, transfer code, reason, paid date and the metadata keys type/schoolId/paymentId/invoiceId). Customer, card and bank details are never stored.
4. The same event twice (same provider + event key) is handled once; the repeat answers `{ processed: true, duplicate: true }`. If the first try FAILED, the provider's own retry runs it again.
5. Exactly one handler may claim an event. None: logged `ignored`. More than one: `failed` (a wiring mistake, never a silent double action).
6. A handler that throws leaves the event `failed` with the reason. The provider still gets a normal 200 (no retry storm); the platform console can retry it.

## Handlers (each lives in the module that owns the data)
| Handler | Module | Claims | Does |
|---|---|---|---|
| `subscriptionWebhookHandler` | subscriptions | `charge.success` with metadata type `subscription_invoice` | `BillingEngine.reconcile(reference)` |
| `feePaymentWebhookHandler` | payments | any other `charge.success` with a reference | finds the school from the metadata and confirms the online payment INSIDE that school's database |
| `transferWebhookHandler` | payroll-transfers | `transfer.*` | finds the school from our own reference (`sal-<school key>-...`) and applies the outcome inside its database |

To add a handler: write a class with `name`, `handles(event)`, `handle(event)` and register it in the owning module's container under a name ending in `WebhookHandler`. To add a provider (for example Flutterwave): implement `WebhookProvider` (`name`, `signatureHeader`, `verify`, `parse`, `slim`) and register it as `<name>WebhookProvider`. The webhooks module finds both by name; nothing in it changes.

## Platform console (`/platform/webhooks`)
| Route | Permission |
|---|---|
| `GET /` (filters: provider, status, type, reference, from, to, page, limit) | `platform.webhooks.view` |
| `GET /summary?hours=24` (counts by status) | `platform.webhooks.view` |
| `GET /:id` (with the fields it kept) | `platform.webhooks.view` |
| `POST /:id/retry` (failed events only; audited as `webhook.retried`) | `platform.webhooks.retry` (sensitive) |

Run `npm run sync:registries` after deploy and grant the two keys to the platform roles that need them.

## Deploy
Public migration `20261107120000_webhook_event_payload_and_attempts` (adds `attempts`, `payload`, `lastAttemptAt`), then `npm run prisma:generate`. In the Paystack dashboard set the webhook URL to `https://<api host>/api/v1/webhooks/paystack` (the old `/api/v1/payments/webhook` path is gone).

## Not done
- Events are kept forever. A retention job (delete processed and ignored events older than N days, N from Platform settings) is the natural next step once there is real volume.
- Events logged before this change have no stored fields, so they cannot be retried from the console (the payments reconciliation job still settles them).
