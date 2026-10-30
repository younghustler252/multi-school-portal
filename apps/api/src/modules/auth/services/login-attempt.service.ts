import { redisConnection } from "../../../infrastructure/jobs/connection";
import { LOGIN_PAIR_MAX_FAILURES, LOGIN_PAIR_WINDOW_SECONDS } from "../domain/auth.enums";
import { authErrors } from "../domain/auth.errors";
import { TokenHashService } from "./token-hash.service";

/*
|--------------------------------------------------------------------------
| LOGIN ATTEMPT LIMITER
| Counts failures per (email + IP). Because the key includes the IP, one
| attacker cannot lock a victim out from everywhere (the account-level lock only
| triggers on a much higher total). The key hashes the email and applies to
| unknown emails too, so it reveals nothing about which accounts exist.
|--------------------------------------------------------------------------
*/

export class LoginAttemptService {
    private readonly redis = redisConnection;
    private readonly hasher: TokenHashService;

    constructor({ tokenHashService }: { tokenHashService: TokenHashService }) {
        this.hasher = tokenHashService;
    }

    private key(email: string, ip: string): string {
        return `auth:login-fail:${this.hasher.fingerprint(email)}:${ip}`;
    }

    async assertNotBlocked(email: string, ip: string): Promise<void> {
        const count = Number(await this.redis.get(this.key(email, ip)) ?? 0);
        if (count >= LOGIN_PAIR_MAX_FAILURES) throw authErrors.loginRateLimited();
    }

    async recordFailure(email: string, ip: string): Promise<void> {
        const key = this.key(email, ip);
        const n   = await this.redis.incr(key);
        if (n === 1) await this.redis.expire(key, LOGIN_PAIR_WINDOW_SECONDS);
    }

    async clear(email: string, ip: string): Promise<void> {
        await this.redis.del(this.key(email, ip));
    }
}
