export const PLATFORM_SETTINGS_PERMISSIONS = [
    {
        key: "platform.settings.manage", realm: "PLATFORM", module: "platform-settings", scopes: ["ALL"], personas: ["STAFF"],
        label: "Manage platform-wide settings", description: "Change platform-level configuration (branding, limits, feature defaults).",
        isSensitive: true,
    },
    {
        key: "platform.queues.view", realm: "PLATFORM", module: "platform-settings", scopes: ["ALL"], personas: ["STAFF"],
        label: "View the background job dashboard", description: "Open /admin/queues (jobs, failures and their data).",
        isSensitive: true,
    },
] as const;
