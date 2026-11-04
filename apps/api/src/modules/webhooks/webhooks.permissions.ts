/*
| WEBHOOK PERMISSION KEYS (platform realm)
| platform.webhooks.view    see the events payment providers sent us, their status and any error
| platform.webhooks.retry   run a failed event again (this can confirm a payment or settle a transfer, so sensitive)
*/
export const WEBHOOK_PERMISSIONS = [
    { key: "platform.webhooks.view",  realm: "PLATFORM", module: "webhooks", scopes: ["ALL"], personas: ["STAFF"], label: "View payment provider events" },
    { key: "platform.webhooks.retry", realm: "PLATFORM", module: "webhooks", scopes: ["ALL"], personas: ["STAFF"], label: "Retry a failed payment provider event", isSensitive: true },
] as const;
