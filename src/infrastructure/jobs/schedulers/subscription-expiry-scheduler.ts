import { subscriptionExpiryQueue } from "../queues/subscription-expiry.queue";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION EXPIRY SCHEDULER
|--------------------------------------------------------------------------
| Periodically checks subscriptions for:
| - Upcoming expiry reminders
| - Auto-renewal
| - Scheduled downgrades
| - Expired subscriptions
| - Grace-period downgrades
|--------------------------------------------------------------------------
*/

export const scheduleSubscriptionExpiry =
    async (): Promise<void> => {
        await subscriptionExpiryQueue.upsertJobScheduler(
            "subscription-expiry-scheduler",
            {
                // Testing: every 1 minute
                // Production: consider 60 * 60 * 1000
                every: 60 * 1000,
            },
            {
                name: "process-expiry",
                data: {
                    runAt: new Date().toISOString(),
                },
                opts: {
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            },
        );

        console.log(
            "⏰ Subscription expiry scheduled — every 1 minute",
        );
    };