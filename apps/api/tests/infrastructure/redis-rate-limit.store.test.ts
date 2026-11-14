/* REM-115: replicas share one counter per key; the first hit sets the window; keys and limiters never collide. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RedisRateLimitStore } from "../../src/infrastructure/middleware/redis-rate-limit.store";

/* A tiny fake that mimics what the two scripts do, shared by both "replicas". */
function fakeRedis() {
    const data = new Map<string, { n: number; exp: number }>();
    return {
        data,
        eval: async (script: string, _n: number, key: string, arg: number) => {
            const now = Date.now(); let e = data.get(key);
            if (e && e.exp <= now) { data.delete(key); e = undefined; }
            if (script.includes("INCR")) { if (!e) { e = { n: 0, exp: now + Number(arg) }; data.set(key, e); } e.n++; return [e.n, e.exp - now]; }
            if (e && e.n > 0) e.n--; return 0;
        },
        del: async (...keys: string[]) => { for (const k of keys) data.delete(k); },
    };
}

describe("redis rate-limit store", () => {
    it("two replicas on one Redis count the same client together", async () => {
        const redis = fakeRedis();
        const a = new RedisRateLimitStore(redis, "rl:global:"), b = new RedisRateLimitStore(redis, "rl:global:");
        a.init({ windowMs: 60_000 }); b.init({ windowMs: 60_000 });
        assert.equal((await a.increment("1.2.3.4")).totalHits, 1);
        assert.equal((await b.increment("1.2.3.4")).totalHits, 2);
        assert.equal((await a.increment("1.2.3.4")).totalHits, 3);
    });
    it("different clients and different limiters have separate counters", async () => {
        const redis = fakeRedis();
        const g = new RedisRateLimitStore(redis, "rl:global:"), au = new RedisRateLimitStore(redis, "rl:auth:");
        g.init({ windowMs: 1000 }); au.init({ windowMs: 1000 });
        await g.increment("1.1.1.1"); await g.increment("1.1.1.1");
        assert.equal((await g.increment("2.2.2.2")).totalHits, 1);
        assert.equal((await au.increment("1.1.1.1")).totalHits, 1);
    });
    it("the window is set on the first hit and reported as the reset time; decrement and reset work", async () => {
        const redis = fakeRedis(); const s = new RedisRateLimitStore(redis, "p:"); s.init({ windowMs: 5_000 });
        const first = await s.increment("k");
        assert.ok(first.resetTime.getTime() - Date.now() <= 5_000 && first.resetTime.getTime() > Date.now());
        await s.increment("k"); await s.decrement("k");
        assert.equal((await s.increment("k")).totalHits, 2);
        await s.resetKey("k");
        assert.equal((await s.increment("k")).totalHits, 1);
    });
});
