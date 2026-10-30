/*
|--------------------------------------------------------------------------
| MAIL PROVIDER INTERFACE
| Both Nodemailer and Brevo implement this contract
|--------------------------------------------------------------------------
*/

export interface SendMailOptions {
    to:          string | string[];
    subject:     string;
    html:        string;
    text?:       string;
    cc?:         string | string[];
    bcc?:        string | string[];
    attachments?: MailAttachment[];
}

export interface MailAttachment {
    filename: string;
    content:  Buffer | string;
    type?:    string;
}

export interface IMailProvider {
    send(options: SendMailOptions): Promise<void>;
}