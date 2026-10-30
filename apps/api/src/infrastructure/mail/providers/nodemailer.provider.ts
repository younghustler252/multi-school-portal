import nodemailer, { Transporter } from "nodemailer";
import { IMailProvider, SendMailOptions } from "../interfaces/mail.interface";

/*
|--------------------------------------------------------------------------
| NODEMAILER LOGGER PROVIDER
| Used in development — completely standalone, zero configuration required.
| Dumps all outgoing transactional emails straight to your terminal window.
|--------------------------------------------------------------------------
*/

export class NodemailerProvider implements IMailProvider {
    private readonly transporter: Transporter;

    constructor() {
        // Safe JSON Logger transport mode eliminates SMTP configuration dependencies
        this.transporter = nodemailer.createTransport({
            jsonTransport: true
        });
    }

    async send(options: SendMailOptions): Promise<void> {
        try {
            const senderEmail = "dev-sandbox@hotspotportal.local";
            
            const info = await this.transporter.sendMail({
                from:        `"Hotspot Dev Platform" <${senderEmail}>`,
                to:          Array.isArray(options.to)
                                 ? options.to.join(", ")
                                 : options.to,
                subject:     options.subject,
                html:        options.html,
                text:        options.text,
                cc:          options.cc,
                bcc:         options.bcc,
                attachments: options.attachments?.map(a => ({
                    filename: a.filename,
                    content:  a.content,
                    contentType: a.type, // Map it correctly to standard Nodemailer notation
                })),
            });

            // Prints out the full message structure cleanly inside your nodemon console layout
            console.log("\n==========================================================================");
            console.log("📨 [DEVELOPMENT EMAIL DISPATCH LOG]");
            console.log(`📅 Timestamp: ${new Date().toISOString()}`);
            console.log(`👤 From:      ${info.message.from?.address || senderEmail}`);
            console.log(`👥 To:        ${options.to}`);
            console.log(`📋 Subject:   ${options.subject}`);
            console.log("--------------------------------------------------------------------------");
            console.log("📝 MESSAGE BODY (HTML Preview Previewed Below):");
            console.log(options.html || options.text || "[Empty message body]");
            console.log("==========================================================================\n");

        } catch (error: any) {
            console.error("❌ Sandbox local email logger runtime operation failed:", error?.message || error);
        }
    }
}
