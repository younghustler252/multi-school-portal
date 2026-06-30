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

        const match    = env.smtp.from.match(/^(.+?)\s*<(.+)>$/);
        this.fromName   = match ? match[1].trim() : "School Portal";
        this.fromEmail  = match ? match[2].trim() : env.smtp.from;
    }

    async send(options: SendMailOptions): Promise<void> {
        const toList = Array.isArray(options.to) ? options.to : [options.to];

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
    }
}