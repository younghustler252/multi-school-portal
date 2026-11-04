import express, { Router } from "express";
import { container } from "../../../container";
import { WebhookController } from "../controllers/webhook.controller";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { webhookLimiter } from "../../../infrastructure/middleware/rate-limit.middleware";

const ctrl = () => container.resolve<WebhookController>("webhookController");

/*
| PROVIDER ENTRY (public, mounted by app.ts BEFORE the JSON parser and the global rate limit):
|   POST /api/v1/webhooks/:provider     signed events from a payment provider (e.g. /webhooks/paystack)
| The raw body is kept as bytes because the signature is checked on exactly what was sent. Webhooks have their own, much
| higher limit: a provider sends bursts from a few addresses and must never be throttled by the 100-per-15-minutes rule.
*/
export const webhookEntryRouter = Router();
webhookEntryRouter.post("/:provider", webhookLimiter, express.raw({ type: "application/json", limit: "1mb" }), (q, s, n) => ctrl().receive(String(q.params.provider), q, s, n));

/*
| PLATFORM CONSOLE (mounted at /platform/webhooks)
|   GET  /            platform.webhooks.view    events, newest first (?provider &status &type &reference &from &to &page &limit)
|   GET  /summary     platform.webhooks.view    counts by status for the last ?hours=24
|   GET  /:id         platform.webhooks.view    one event with the fields it kept
|   POST /:id/retry   platform.webhooks.retry   run a FAILED event again
*/
const router = Router();
router.get("/", authenticate, requirePermission("platform.webhooks.view"), (q, s, n) => ctrl().list(q, s, n));
router.get("/summary", authenticate, requirePermission("platform.webhooks.view"), (q, s, n) => ctrl().summary(q, s, n));
router.get("/:id", authenticate, requirePermission("platform.webhooks.view"), (q, s, n) => ctrl().get(q, s, n));
router.post("/:id/retry", authenticate, requirePermission("platform.webhooks.retry"), (q, s, n) => ctrl().retry(q, s, n));
export default router;
