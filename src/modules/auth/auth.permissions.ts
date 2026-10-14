/*
|--------------------------------------------------------------------------
| AUTH PERMISSION KEYS (code registry input)
| Register these in the permission registry when it is built (same sync
| mechanism as feature keys). Until then routes already enforce them by key.
|--------------------------------------------------------------------------
*/
export const AUTH_PERMISSIONS = [
    {
        key:        "users.invite",
        realm:      "SCHOOL",
        module:     "users",
        scopes:     ["ALL"],
        personas:   ["STAFF"],
        label:      "Invite and manage invitations",
        description:"Send, resend, revoke and list invitations to the school.",
        isSensitive: true,
    },
] as const;
