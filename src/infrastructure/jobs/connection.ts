import { Redis }   from "ioredis";
import { env }      from "../../config/env";
import { tr } from "zod/v4/locales";

/*
|--------------------------------------------------------------------------
| REDIS CONNECTION FOR BULLMQ
| Shared connection used by all queues and workers
|--------------------------------------------------------------------------
*/

const client = new Redis({
    host:                env.redis.host,
    port:                env.redis.port,
    maxRetriesPerRequest: null,   // required by BullMQ
    lazyConnect: true,
});

client.on("connect", () => {
    console.log("🔌 Redis connected (BullMQ)");
});

client.on("error", (err) => {
    console.error("❌ Redis connection error:", err.message);
});

export const redisConnection = client as any;
