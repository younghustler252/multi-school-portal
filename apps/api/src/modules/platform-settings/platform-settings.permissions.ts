export const PLATFORM_SETTINGS_PERMISSIONS = [
    {
        key: "platform.settings.manage", realm: "PLATFORM", module: "platform-settings", scopes: ["ALL"], personas: ["STAFF"],
        label: "Manage platform-wide settings", description: "Change platform-level configuration (branding, limits, feature defaults).",
        isSensitive: true,
    },
] as const;
