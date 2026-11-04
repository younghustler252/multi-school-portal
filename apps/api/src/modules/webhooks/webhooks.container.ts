import { asClass, asFunction } from "awilix";
import type { AwilixContainer } from "awilix";
import { WebhookEventRepositoryImpl } from "./repositories/webhook-event.repository.impl";
import { PaystackWebhookProvider } from "./providers/paystack.webhook-provider";
import { WebhookProcessor } from "./services/webhook-processor.service";
import { registryFrom } from "./webhooks.registry";
import { ReceiveWebhookUseCase, ListWebhookEventsUseCase, GetWebhookEventUseCase, WebhookSummaryUseCase, RetryWebhookEventUseCase } from "./usecases/webhook.usecases";
import { WebhookController } from "./controllers/webhook.controller";

/*
|--------------------------------------------------------------------------
| WEBHOOKS CONTAINER
| Providers are registered as `<name>WebhookProvider`, handlers as `<name>WebhookHandler` by the module that owns the data
| (see webhooks.registry.ts). This container only wires the front door.
|--------------------------------------------------------------------------
*/
export const registerWebhooks = (container: AwilixContainer): void => {
    container.register({
        webhookEventRepository:     asClass(WebhookEventRepositoryImpl).singleton(),
        paystackWebhookProvider:    asClass(PaystackWebhookProvider).singleton(),
        webhookRegistry:            asFunction(() => registryFrom(container)).singleton(),
        webhookHandlers:            asFunction(({ webhookRegistry }: { webhookRegistry: ReturnType<typeof registryFrom> }) => () => webhookRegistry.handlers()).singleton(),
        webhookProviderFor:         asFunction(({ webhookRegistry }: { webhookRegistry: ReturnType<typeof registryFrom> }) => (name: string) => webhookRegistry.provider(name)).singleton(),
        webhookProcessor:           asClass(WebhookProcessor).singleton(),
        receiveWebhookUseCase:      asClass(ReceiveWebhookUseCase).scoped(),
        listWebhookEventsUseCase:   asClass(ListWebhookEventsUseCase).scoped(),
        getWebhookEventUseCase:     asClass(GetWebhookEventUseCase).scoped(),
        webhookSummaryUseCase:      asClass(WebhookSummaryUseCase).scoped(),
        retryWebhookEventUseCase:   asClass(RetryWebhookEventUseCase).scoped(),
        webhookController:          asClass(WebhookController).scoped(),
    });
};
