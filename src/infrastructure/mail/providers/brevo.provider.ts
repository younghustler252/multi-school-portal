import { BrevoClient }                    from "@getbrevo/brevo";
import { IMailProvider, SendMailOptions } from "../interfaces/mail.interface";
import { env }                            from "../../../config/env";

/*
|--------------------------------------------------------------------------
| BREVO PROVIDER
| Used in production — transactional email via Brevo (SDK v6)
|--------------------------------------------------------------------------
*/

export class BrevoProvider implements IMailProvider {
    private readonly client:    BrevoClient;
    private readonly fromEmail: string;
    private readonly fromName:  string;

    constructor() {
        this.client = new BrevoClient({
            apiKey: env.brevo.apiKey,
        });

        // Safe evaluation path: priorizes explicit brevo config first, falls back to parsed SMTP variables
        const sourceString = env.brevo.senderEmail || env.smtp.from;
        const match        = sourceString.match(/^(.+?)\s*<(.+)>$/);

        if (match) {
            this.fromName  = match[1].trim();
            this.fromEmail = match[2].trim();
        } else {
            this.fromName  = env.brevo.senderName || "Hotspot Portal";
            this.fromEmail = sourceString;
        }
    }

    async send(options: SendMailOptions): Promise<void> {
        const toList = Array.isArray(options.to) ? options.to : [options.to];

        try {
            await this.client.transactionalEmails.sendTransacEmail({
                sender:      { name: this.fromName, email: this.fromEmail },
                to:          toList.map((e: string) => ({ email: e })),
                subject:     options.subject,
                htmlContent: options.html,
                textContent: options.text,
                ...(options.cc && {
                    cc: (Array.isArray(options.cc) ? options.cc : [options.cc])
                            .map((e: string) => ({ email: e })),
                }),
            });
        } catch (error: any) {
            // Logs out API issues without causing system crashes
            console.error("❌ Brevo mail dispatch pipeline execution failed:", error?.message || error);
            throw new Error(`Email delivery failed: ${error?.message || "Unknown Brevo Exception"}`);
        }
    }
}
