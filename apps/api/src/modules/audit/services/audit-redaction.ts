/*
|--------------------------------------------------------------------------
| AUDIT REDACTION (REM-079)
| Every audit write goes through redactAuditValue() inside AuditService.log, so a caller that passes a whole entity or
| request body can never store a credential in the audit table. Matching is by KEY NAME, at any depth:
|   REMOVED  (value replaced by "[REDACTED]"): passwords and hashes, OTP/PIN codes, tokens, secrets, API/private keys,
|            authorization headers and cookies, signatures, CVV
|   MASKED   (only the last 4 characters kept): bank account, card and identity numbers (BVN, NIN, TIN)
| Values are also made JSON-safe: bigint -> string, Date -> ISO text; depth and size are capped.
| This is the safety net. Choosing WHICH fields an event should record at all (per-entity allowlists) stays with each
| module, because only the module knows what is useful to an auditor.
|--------------------------------------------------------------------------
*/
export const REDACTED = "[REDACTED]";

/* Keys are split into words (camelCase, snake_case, kebab-case) and matched as WHOLE words, so "shipping" never matches "pin". */
const words = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const SECRET_WORDS = new Set(["password", "passwd", "pwd", "passcode", "passphrase", "hash", "salt", "otp", "pin", "secret", "secrets", "token", "tokens",
    "apikey", "signature", "cvv", "cvc", "credential", "credentials", "cookie", "cookies", "authorization"]);
const secretPhrase = (w: string[]) => w.some((x, i) => (x === "api" || x === "private" || x === "session") && (w[i + 1] === "key" || (x === "session" && w[i + 1] === "id")));
const MASK_PHRASES = [["account", "number"], ["account", "no"], ["account", "num"], ["bank", "account"], ["card", "number"], ["card", "no"], ["card", "num"]];
const MASK_WORDS = new Set(["iban", "pan", "bvn", "nin", "tin", "ssn"]);
const hasPhrase = (w: string[], p: string[]) => w.some((_, i) => p.every((x, j) => w[i + j] === x));
// a key that names a secret but only reports ABOUT it (a flag, a count, a time, a type) holds no secret
const SAFE_KEY = /^(has|is|was|can|should)[A-Z_]|(Count|Type|Kind|At|Length|Required|Status|Used|Expired)$|_(count|type|kind|at|length|required|status|used|expired)$/;

const isSecret = (key: string) => { const w = words(key); return !SAFE_KEY.test(key) && (w.some(x => SECRET_WORDS.has(x)) || secretPhrase(w)); };
const isMasked = (key: string) => { const w = words(key); return w.some(x => MASK_WORDS.has(x)) || MASK_PHRASES.some(p => hasPhrase(w, p)); };

const MAX_DEPTH = 8, MAX_KEYS = 200, MAX_ITEMS = 500;

const mask = (v: unknown) => { const s = String(v ?? ""); return s.length <= 4 ? "****" : `${"*".repeat(Math.min(s.length - 4, 12))}${s.slice(-4)}`; };

export function redactAuditValue(value: unknown, depth = 0): any {
    if (value === null || value === undefined) return value ?? null;
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (typeof value !== "object") return typeof value === "function" || typeof value === "symbol" ? undefined : value;
    if (depth >= MAX_DEPTH) return "[TRUNCATED]";
    if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map(v => redactAuditValue(v, depth + 1));

    const out: Record<string, any> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
        if (v === undefined) continue;
        if (isSecret(key)) { out[key] = REDACTED; continue; }
        if (isMasked(key) && (typeof v === "string" || typeof v === "number")) { out[key] = mask(v); continue; }
        out[key] = redactAuditValue(v, depth + 1);
    }
    return out;
}
