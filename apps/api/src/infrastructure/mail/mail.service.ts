import { IMailProvider, SendMailOptions } from "./interfaces/mail.interface";
import { NodemailerProvider }             from "./providers/nodemailer.provider";
import { BrevoProvider }                  from "./providers/brevo.provider";
import { OtpTemplateParams, otpTemplate } from "./templates/otp.templates";
import {
    letterTemplate,
    LetterTemplateParams,
}                                         from "./templates/letter.template";
import { env }                            from "../../config/env";

/*
|--------------------------------------------------------------------------
| MAIL SERVICE
| Single entry point for all email sending
| Picks provider based on NODE_ENV automatically
|--------------------------------------------------------------------------
*/

export class MailService {
    private readonly provider: IMailProvider;

    constructor() {
        this.provider = env.NODE_ENV === "production"
            ? new BrevoProvider()
            : new NodemailerProvider();

        console.log(
            `📧 Mail provider: ${
                env.NODE_ENV === "production" ? "Brevo" : "Nodemailer"
            }`,
        );
    }

    // ── Generic ──────────────────────────────────────────────────────────
    async send(options: SendMailOptions): Promise<void> {
        await this.provider.send(options);
    }

    // ── OTP ──────────────────────────────────────────────────────────────
    async sendOtp(
        to:     string,
        params: OtpTemplateParams,
    ): Promise<void> {
        const { subject, html } = otpTemplate(params);
        await this.send({ to, subject, html });
    }

    // ── Letter (general purpose) ─────────────────────────────────────────
    async sendLetter(
        to:     string | string[],
        params: LetterTemplateParams,
    ): Promise<void> {
        const { subject, html } = letterTemplate(params);
        await this.send({ to, subject, html });
    }

    // ── Convenience wrappers using sendLetter ────────────────────────────
    async sendWelcome(params: {
        to:         string;
        adminName:  string;
        schoolName: string;
        loginUrl:   string;
    }): Promise<void> {
        await this.sendLetter(params.to, {
            subject:    `Welcome to SchoolPortal — ${params.schoolName} is live!`,
            title:      "Welcome to SchoolPortal 🎉",
            greeting:   `Hi ${params.adminName},`,
            paragraphs: [
                `Your school <strong>${params.schoolName}</strong> has been verified and is now live on SchoolPortal.`,
                "You can now add your staff, students, set up classes, track attendance, manage fees, and a lot more.",
            ],
            button: {
                label: "Go to Dashboard",
                url:   params.loginUrl,
            },
            preheader: `${params.schoolName} is now live on SchoolPortal`,
        });
    }

    async sendInvite(params: {
        to:         string;
        firstName:  string;
        schoolName: string;
        role:       string;
        inviteUrl:  string;
        expiresIn:  string;
    }): Promise<void> {
        await this.sendLetter(params.to, {
            subject:    `You've been invited to join ${params.schoolName}`,
            title:      "You're Invited!",
            greeting:   `Hi ${params.firstName},`,
            paragraphs: [
                `You have been invited to join <strong>${params.schoolName}</strong> as a <strong>${params.role}</strong>.`,
                `This invitation expires in <strong>${params.expiresIn}</strong>.`,
            ],
            button: {
                label: "Accept Invitation",
                url:   params.inviteUrl,
            },
            footer:     "If you did not expect this invitation, please ignore this email.",
            preheader:  `Join ${params.schoolName} on SchoolPortal`,
        });
    }

    async sendSubscriptionExpiry(params: {
        to:         string;
        adminName:  string;
        schoolName: string;
        expiryDate: string;
        upgradeUrl: string;
    }): Promise<void> {
        await this.sendLetter(params.to, {
            subject:    "Your subscription is expiring soon",
            title:      "Subscription Expiring Soon",
            greeting:   `Hi ${params.adminName},`,
            paragraphs: [
                `Your <strong>${params.schoolName}</strong> subscription expires on <strong>${params.expiryDate}</strong>.`,
                "After this date, access to premium features will be restricted. Renew now to avoid any interruption.",
            ],
            button: {
                label: "Renew Subscription",
                url:   params.upgradeUrl,
            },
            preheader: "Your SchoolPortal subscription is expiring soon",
        });
    }

    async sendPaymentReceipt(params: {
        to:          string;
        firstName:   string;
        schoolName:  string;
        amount:      string;
        reference:   string;
        date:        string;
        receiptUrl?: string;
    }): Promise<void> {
        await this.sendLetter(params.to, {
            subject:    `Payment Receipt — ${params.schoolName}`,
            title:      "Payment Confirmed ✓",
            greeting:   `Hi ${params.firstName},`,
            paragraphs: [
                `Your payment of <strong>${params.amount}</strong> to <strong>${params.schoolName}</strong> has been confirmed.`,
                `Reference: <strong>${params.reference}</strong>`,
                `Date: <strong>${params.date}</strong>`,
            ],
            ...(params.receiptUrl && {
                button: {
                    label: "Download Receipt",
                    url:   params.receiptUrl,
                },
            }),
            preheader: `Payment of ${params.amount} confirmed`,
        });
    }
}