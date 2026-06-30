import nodemailer, { Transporter } from "nodemailer";
import { IMailProvider, SendMailOptions } from "../interfaces/mail.interface";
import { env }                            from "../../../config/env";

/*
|--------------------------------------------------------------------------
| NODEMAILER PROVIDER
| Used in development — sends via SMTP (Gmail, Mailtrap etc)
|--------------------------------------------------------------------------
*/

export class NodemailerProvider implements IMailProvider {
    private readonly transporter: Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host:   env.smtp.host,
            port:   env.smtp.port,
            secure: env.smtp.port === 465,
            auth: {
                user: env.smtp.user,
                pass: env.smtp.pass,
            },
        });
    }

    async send(options: SendMailOptions): Promise<void> {
        await this.transporter.sendMail({
            from:        env.smtp.from,
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
                type:     a.type,
            })),
        });
    }
}