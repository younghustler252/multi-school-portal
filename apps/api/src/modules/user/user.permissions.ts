/*
| USER MODULE PERMISSION KEYS (register in the permission registry when it is built).
| Profile, password, avatar, access and session endpoints act only on the caller's own
| account, so they need authentication, not a permission.
*/
export const USER_PERMISSIONS = [
    {
        key:         "platform.users.view",
        realm:       "PLATFORM",
        module:      "users",
        scopes:      ["ALL"],
        personas:    ["STAFF"],
        label:       "View user accounts",
        description: "List and search user accounts across all schools (read-only). Changing accounts needs 'Manage user accounts'.",
        isSensitive: false,
    },
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
