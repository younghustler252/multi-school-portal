import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createContainer, asClass, asFunction, asValue, InjectionMode } from "awilix";
import { registryFrom } from "../../src/modules/webhooks/webhooks.registry";
import { registerWebhooks } from "../../src/modules/webhooks/webhooks.container";
import { ListWebhookEventsQuery } from "../../src/modules/webhooks/dtos/webhook.dto";
import { WEBHOOK_PERMISSIONS } from "../../src/modules/webhooks/webhooks.permissions";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";

// Needs the installed packages awilix and zod (the other webhook tests run without them).
describe("wiring", () => {
    it("the registry finds providers and handlers by their names in a real awilix container, from any module", () => {
        const c = createContainer({ injectionMode: InjectionMode.PROXY });
        class P { readonly name = "paystack"; }
        class H1 { readonly name = "one"; handles() { return false; } }
        class H2 { readonly name = "two"; handles() { return false; } }
        c.register({
            paystackWebhookProvider: asClass(P).singleton(), subscriptionWebhookHandler: asClass(H1).scoped(), feePaymentWebhookHandler: asClass(H2).scoped(),
            somethingElse: asValue(1),
        });
        const reg = registryFrom(c);
        assert.equal(reg.provider("paystack")?.name, "paystack"); assert.equal(reg.provider("nope"), null);
        assert.deepEqual(reg.handlers().map(h => h.name).sort(), ["one", "two"]);
    });
    it("permissions are platform keys in their own module and valid in the registry; the retry key is sensitive", () => {
        assert.deepEqual(validatePermissionRegistry(PERMISSION_REGISTRY), []);
        assert.deepEqual(WEBHOOK_PERMISSIONS.map(p => p.key), ["platform.webhooks.view", "platform.webhooks.retry"]);
        assert.ok(PERMISSION_REGISTRY.filter(p => p.module === "webhooks").length === 2);
        assert.equal((WEBHOOK_PERMISSIONS[1] as any).isSensitive, true);
    });
    it("list filters are strict and bounded", () => {
        assert.ok(ListWebhookEventsQuery.safeParse({ status: "failed", limit: "50", from: "2026-11-01" }).success);
        assert.equal(ListWebhookEventsQuery.safeParse({ status: "oops" }).success, false);
        assert.equal(ListWebhookEventsQuery.safeParse({ limit: "500" }).success, false);
        assert.equal(ListWebhookEventsQuery.safeParse({ extra: 1 }).success, false);
    });
});

describe("container", () => {
    it("registerWebhooks adds the front door; handlers registered later by other modules are still found", () => {
        const c = createContainer({ injectionMode: InjectionMode.PROXY });
        registerWebhooks(c);
        class H { readonly name = "late"; handles() { return false; } }
        c.register({ lateWebhookHandler: asClass(H).scoped() });
        const handlers = c.resolve<() => { name: string }[]>("webhookHandlers")();
        assert.deepEqual(handlers.map(h => h.name), ["late"]);
        for (const k of ["receiveWebhookUseCase", "retryWebhookEventUseCase", "webhookController", "webhookProcessor"]) assert.ok(c.hasRegistration(k), k);
    });
});
