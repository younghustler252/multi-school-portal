import { PrismaClient } from "../../../generated/public/client";
import { MailService }  from "../../../infrastructure/mail/mail.service";
import { AUTH_TEMPLATES, AuthTemplateDef } from "../auth.templates";
import { authErrors } from "../domain/auth.errors";

const escapeHtml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const BUTTON = /^\[\[button:(.+?)\|(.+?)\]\]$/;
const FOOTER = /^\[\[footer:(.+?)\]\]$/;

/*
|--------------------------------------------------------------------------
| AUTH MESSAGE SERVICE
| Resolves an auth template (platform row, else the code default so sign-in
| never breaks if the sync was not run), fills placeholders from PlatformSettings
| plus the caller's variables, and sends it through MailService.sendLetter.
| Auth messages are never school-overridable.
|--------------------------------------------------------------------------
*/

export class AuthMessageService {
    private readonly prisma: PrismaClient;
    private readonly mail:   MailService;

    constructor({ prismaClient, mailService }: { prismaClient: PrismaClient; mailService: MailService }) {
        this.prisma = prismaClient;
        this.mail   = mailService;
    }

    private async platformVars(): Promise<Record<string, string>> {
        const s = await this.prisma.platformSettings.findFirst();
        return {
            "platform.name":         s?.shortName ?? s?.platformName ?? "",
            "platform.supportEmail": s?.supportEmail ?? "",
        };
    }

    private async resolve(key: string): Promise<{ subject: string; body: string; def: AuthTemplateDef }> {
        const def = AUTH_TEMPLATES.find(t => t.key === key);
        if (!def) throw authErrors.badRequest(`Unknown message template "${key}"`);

        const row = await this.prisma.messageTemplate.findUnique({
            where: { key_channel_locale: { key, channel: "EMAIL", locale: "en" } },
        });
        return row && row.isActive
            ? { subject: row.subject ?? def.subject, body: row.body, def }
            : { subject: def.subject, body: def.body, def };
    }

    private fill(text: string, vars: Record<string, string>): string {
        return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, name) => escapeHtml(vars[name] ?? ""));
    }

    /** Sends an auth email. Throws if a required variable is missing. */
    async sendEmail(key: string, to: string, vars: Record<string, string | undefined>): Promise<void> {
        const { subject, body, def } = await this.resolve(key);

        const all: Record<string, string> = {
            ...(await this.platformVars()),
            "recipient.firstName": "there",
        };
        for (const [k, v] of Object.entries(vars)) if (v !== undefined && v !== "") all[k] = v;

        for (const v of def.variables) {
            if (v.required && !all[v.key]) {
                throw authErrors.badRequest(`Message "${key}" is missing required value "${v.key}"`);
            }
        }

        let button: { label: string; url: string } | undefined;
        let footer: string | undefined;
        const paragraphs: string[] = [];

        for (const block of body.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)) {
            const b = BUTTON.exec(block);
            const f = FOOTER.exec(block);
            if (b)      button = { label: this.fill(b[1], all), url: this.fillRaw(b[2], all) };
            else if (f) footer = this.fill(f[1], all);
            else        paragraphs.push(this.fill(block, all).replace(/\n/g, "<br/>"));
        }

        const [greeting = "", ...rest] = paragraphs;
        const renderedSubject = this.fillPlain(subject, all);

        await this.mail.sendLetter(to, {
            subject:    renderedSubject,
            title:      renderedSubject,
            greeting,
            paragraphs: rest,
            ...(button ? { button } : {}),
            ...(footer ? { footer } : {}),
            preheader:  renderedSubject,
        });
    }

    /** Fire-and-forget variant for flows that must not reveal whether an account exists. */
    sendEmailSafely(key: string, to: string, vars: Record<string, string | undefined>): void {
        this.sendEmail(key, to, vars).catch(err =>
            console.error(`[auth-message] failed to send ${key}:`, (err as Error).message),
        );
    }

    // URLs are not HTML-escaped (they are attribute values built by UrlService)
    private fillRaw(text: string, vars: Record<string, string>): string {
        return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, name) => vars[name] ?? "");
    }

    // Subject lines are plain text
    private fillPlain(text: string, vars: Record<string, string>): string {
        return this.fillRaw(text, vars);
    }
}
