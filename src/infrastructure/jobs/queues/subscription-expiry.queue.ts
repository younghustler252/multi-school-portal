import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION EXPIRY QUEUE
|--------------------------------------------------------------------------
| Processes subscription expiry, renewal, grace-period and downgrade checks.
|--------------------------------------------------------------------------
*/

export interface SubscriptionExpiryJobData {
    runAt: string;
}

export const subscriptionExpiryQueue =
    new Queue<SubscriptionExpiryJobData>(
        "subscription-expiry",
        {
            connection: redisConnection,
        },
    );