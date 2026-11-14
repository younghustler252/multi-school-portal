/*
|--------------------------------------------------------------------------
| REDIS RATE-LIMIT STORE (REM-115)
| With several API replicas the default in-memory store gives every process its own counters, so a client can spread
| requests across replicas and exceed the limit. This store keeps one counter per key in Redis so all replicas share it.
| It implements express-rate-limit's Store interface directly (no extra package). Increment is ONE atomic script:
| INCR, set the expiry on the first hit, return the count and the remaining time.
|--------------------------------------------------------------------------
*/
export interface RedisLike { eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>; del(...keys: string[]): Promise<unknown> }

const INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return { hits, ttl }`;
const DECREMENT = `
local hits = redis.call('GET', KEYS[1])
if hits and tonumber(hits) > 0 then return redis.call('DECR', KEYS[1]) end
return 0`;

export class RedisRateLimitStore {
    /** Counters are shared across processes, so the library must not assume a per-process key space. */
    readonly localKeys = false;
    private windowMs = 60_000;
    constructor(private readonly client: RedisLike, private readonly prefix: string) {}

    init(options: { windowMs: number }) { this.windowMs = options.windowMs; }
    private k(key: string) { return `${this.prefix}${key}`; }

    async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
        const [hits, ttl] = (await this.client.eval(INCREMENT, 1, this.k(key), this.windowMs)) as [number, number];
        return { totalHits: Number(hits), resetTime: new Date(Date.now() + Number(ttl)) };
    }
    async decrement(key: string): Promise<void> { await this.client.eval(DECREMENT, 1, this.k(key)); }
    async resetKey(key: string): Promise<void> { await this.client.del(this.k(key)); }
}
