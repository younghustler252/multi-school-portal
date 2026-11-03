/*
| Submitting feedback and viewing your own are open to any authenticated session (no permission key —
| same as before this module was wired in). Only reviewing/managing everyone's feedback is gated: this
| lists and acts across every school at once, so it's a platform-realm action, not a school one.
*/
export const FEEDBACK_PERMISSIONS = [
    {
        key: "platform.feedback.manage", realm: "PLATFORM", module: "feedback", scopes: ["ALL"], personas: ["STAFF"],
        label: "Review and manage submitted feedback", description: "List all feedback, respond to it, change its status, or delete it.",
    },
] as const;
