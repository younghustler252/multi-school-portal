import { PrismaClient } from "../../../generated/public/client";

/*
|--------------------------------------------------------------------------
| AUTH MESSAGE TEMPLATES (code registry)
| Code owns: key, channel, locale, category, variables.
| Data owns: subject and body wording (edited in the platform console).
| `syncAuthTemplates` creates missing rows with the defaults below and, for
| existing rows, updates ONLY the code-owned columns. Wording is never overwritten.
| Run it from sync-registries.ts on every deploy.
|
| Body format: paragraphs separated by a blank line. The first paragraph is the
| greeting. Optional control lines:  [[button:Label|{{url}}]]   [[footer:text]]
| Placeholders: {{name}}. Always available: platform.name, platform.supportEmail,
| recipient.firstName. Values are HTML-escaped when rendered.
|--------------------------------------------------------------------------
*/

export interface TemplateVariable { key: string; required: boolean }

export interface AuthTemplateDef {
    key:       string;
    channel:   "EMAIL";
    locale:    "en";
    category:  "AUTH";
    variables: TemplateVariable[];
    subject:   string;
    body:      string;
}

const base: TemplateVariable[] = [
    { key: "platform.name",         required: true  },
    { key: "platform.supportEmail", required: false },
    { key: "recipient.firstName",   required: false },
];

export const AUTH_TEMPLATES: AuthTemplateDef[] = [
    {
        key: "auth.otp.email_verification", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [...base, { key: "otp.code", required: true }, { key: "otp.expiresIn", required: true }],
        subject: "Verify your email address",
        body:
`Hi {{recipient.firstName}},

Use this code to verify your email address. It expires in {{otp.expiresIn}}.

Your code: {{otp.code}}

If you did not request this, you can safely ignore this email.`,
    },
    {
        key: "auth.otp.password_reset", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [...base, { key: "otp.code", required: true }, { key: "otp.expiresIn", required: true }],
        subject: "Your password reset code",
        body:
`Hi {{recipient.firstName}},

Use this code to reset your password. It expires in {{otp.expiresIn}}.

Your code: {{otp.code}}

If you did not request a password reset, ignore this email. Your password has not changed.`,
    },
    {
        key: "auth.invite", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [
            ...base,
            { key: "school.name",      required: true },
            { key: "invite.roleName",  required: true },
            { key: "invite.expiresIn", required: true },
            { key: "invite.url",       required: true },
        ],
        subject: "You have been invited to join {{school.name}}",
        body:
`Hi {{recipient.firstName}},

You have been invited to join {{school.name}} as {{invite.roleName}}. This invitation expires in {{invite.expiresIn}}.

[[button:Accept invitation|{{invite.url}}]]

[[footer:If you did not expect this invitation, you can ignore this email.]]`,
    },
    {
        key: "auth.welcome", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [...base, { key: "school.name", required: true }, { key: "school.url", required: true }],
        subject: "Welcome to {{school.name}}",
        body:
`Hi {{recipient.firstName}},

Your account for {{school.name}} is ready. You can sign in any time from the link below.

[[button:Go to {{school.name}}|{{school.url}}]]

[[footer:If you did not create this account, contact {{platform.supportEmail}}.]]`,
    },
    {
        key: "auth.password_reset_by_support", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [
            ...base,
            { key: "school.name",   required: true },
            { key: "temp.password", required: true },
        ],
        subject: "Your password has been reset",
        body:
`Hi {{recipient.firstName}},

The password for your {{school.name}} account was reset by {{platform.name}} support.

Temporary password: {{temp.password}}

You will be asked to choose a new password the next time you sign in.

[[footer:If you did not expect this, contact {{platform.supportEmail}} immediately.]]`,
    },
    {
        key: "auth.account_created_by_platform", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [...base, { key: "school.name", required: true }, { key: "school.url", required: true }, { key: "temp.password", required: true }],
        subject: "Your {{school.name}} account is ready",
        body:
`Hi {{recipient.firstName}},

{{platform.name}} has set up {{school.name}} for you. Sign in with this temporary password and choose a new one when asked.

Temporary password: {{temp.password}}

[[button:Sign in|{{school.url}}]]`,
    },
    {
        key: "school.payment_account_changed", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [...base, { key: "school.name", required: true }, { key: "account.last4", required: true }],
        subject: "The payment account for {{school.name}} was changed",
        body:
`Hi {{recipient.firstName}},

The account that receives fee payments for {{school.name}} was just changed to one ending in {{account.last4}}.

[[footer:If this was not you, contact {{platform.supportEmail}} immediately.]]`,
    },
    {
        key: "auth.password_changed", channel: "EMAIL", locale: "en", category: "AUTH",
        variables: [...base],
        subject: "Your password was changed",
        body:
`Hi {{recipient.firstName}},

The password on your {{platform.name}} account was just changed. Any other devices have been signed out.

If this was not you, reset your password immediately and contact {{platform.supportEmail}}.`,
    },
];

export async function syncAuthTemplates(prisma: PrismaClient): Promise<{ created: number; updated: number }> {
    let created = 0, updated = 0;
    for (const t of AUTH_TEMPLATES) {
        const where = { key_channel_locale: { key: t.key, channel: t.channel, locale: t.locale } };
        const existing = await prisma.messageTemplate.findUnique({ where });
        if (!existing) {
            await prisma.messageTemplate.create({
                data: {
                    key: t.key, channel: t.channel, locale: t.locale, category: t.category,
                    variables: t.variables as never, isSchoolOverridable: false,
                    subject: t.subject, body: t.body, isActive: true, version: 1,
                },
            });
            created++;
        } else {
            await prisma.messageTemplate.update({
                where, data: { category: t.category, variables: t.variables as never },
            });
            updated++;
        }
    }
    return { created, updated };
}
