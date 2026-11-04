import type { AwilixContainer } from "awilix";
import type { WebhookHandler, WebhookProvider } from "./domain/webhook.types";

/*
| The providers and handlers the webhooks module can use. A module that owns the meaning of an event registers its handler
| in its own container under a name ending in "WebhookHandler" (for example `subscriptionWebhookHandler`); a provider is
| registered as `<name>WebhookProvider`. The webhooks module finds them by those names when an event arrives, so adding a
| provider or a handler never edits this module.
*/
export const HANDLER_SUFFIX  = "WebhookHandler";
export const PROVIDER_SUFFIX = "WebhookProvider";

export interface WebhookRegistry {
    provider(name: string): WebhookProvider | null;
    handlers(): WebhookHandler[];
}

export function registryFrom(container: Pick<AwilixContainer, "registrations" | "resolve">): WebhookRegistry {
    const named = <T>(suffix: string): T[] =>
        Object.keys(container.registrations).filter(k => k.endsWith(suffix)).map(k => container.resolve<T>(k));
    return {
        provider: (name) => named<WebhookProvider>(PROVIDER_SUFFIX).find(p => p.name === name) ?? null,
        handlers: () => named<WebhookHandler>(HANDLER_SUFFIX),
    };
}
