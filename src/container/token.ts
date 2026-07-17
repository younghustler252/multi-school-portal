/*
|--------------------------------------------------------------------------
| TOKENS
| String keys for all container registrations
| Used to resolve dependencies without typos
|--------------------------------------------------------------------------
*/
export const TOKENS = {

    // ── Infrastructure ──────────────────────────────────────────────────
    prismaClient:           "prismaClient",
    tenantContext:          "tenantContext",

    // ── Shared Services ─────────────────────────────────────────────────
    emailService:           "emailService",
    smsService:             "smsService",
    storageService:         "storageService",
    paystackProvider:        "paystackProvider",
    tokenService:           "tokenService",
    passwordService:        "passwordService",
} as const;