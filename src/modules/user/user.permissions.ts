/*
| USER MODULE PERMISSION KEYS (register in the permission registry when it is built).
| Profile, password, avatar, access and session endpoints act only on the caller's own
| account, so they need authentication, not a permission.
*/
export const USER_PERMISSIONS = [
    {
        key:         "platform.users.manage",
        realm:       "PLATFORM",
        module:      "users",
        scopes:      ["ALL"],
        personas:    ["STAFF"],
        label:       "Manage user accounts",
        description: "Reset a school administrator's password and manage platform-level user accounts.",
        isSensitive: true,
    },
] as const;
