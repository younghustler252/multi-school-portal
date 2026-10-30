import { subscriptionExpiryQueue } from "../queues/subscription-expiry.queue";

/*
| The old every-minute subscription expiry job is replaced by the hourly billing job (queues/billing.queue.ts).
| Earlier versions registered a repeating job in Redis; this removes it once. Removing one that is not there is harmless.
*/
export const retireSubscriptionExpiry = async (): Promise<void> => {
    await subscriptionExpiryQueue.removeJobScheduler("subscription-expiry-scheduler");
};
