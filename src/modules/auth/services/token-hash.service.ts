import { createHash, createHmac, timingSafeEqual } from "crypto";
import { env } from "../../../config/env";

/*
|--------------------------------------------------------------------------
| TOKEN HASH SERVICE
| Refresh tokens, invite tokens and OTP codes are stored only as keyed hashes
| (HMAC-SHA256 with a key derived from ENCRYPTION_KEY). A database leak then
| yields nothing usable. OTP hashes are bound to user and type, so a code
| cannot be replayed across accounts or flows.
| Rotating ENCRYPTION_KEY invalidates all stored hashes (sessions, pending invites and OTPs).
|--------------------------------------------------------------------------
*/

export class TokenHashService {
    private readonly key: Buffer = createHash("sha256")
        .update(`auth-token-hash:${env.encryptionKey}`)
        .digest();

    hashToken(token: string): string {
        return createHmac("sha256", this.key).update(token).digest("hex");
    }

    hashOtp(userId: string, type: string, code: string): string {
        return createHmac("sha256", this.key).update(`${userId}:${type}:${code}`).digest("hex");
    }

    // Constant-time comparison of two hex digests
    safeEqual(a: string, b: string): boolean {
        const ba = Buffer.from(a, "hex");
        const bb = Buffer.from(b, "hex");
        return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
    }

    // Short stable fingerprint for rate-limit keys and audit (never reversible to the email)
    fingerprint(value: string): string {
        return createHmac("sha256", this.key).update(value).digest("hex").slice(0, 24);
    }
}
