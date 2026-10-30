import { SendSmsOptions, ISmsProvider } from "./interfaces/sms.interface";
import { TermiiProvider }               from "./providers/termii.provider";
import { env }                          from "../../config/env";

/*
|--------------------------------------------------------------------------
| SMS SERVICE
| Single entry point for all SMS sending
| In development — logs to console instead of sending real SMS
| In production — sends via Termii
|--------------------------------------------------------------------------
*/

export class SmsService {
    private readonly provider: ISmsProvider;

    constructor() {
        if (env.NODE_ENV === "production") {
            this.provider = new TermiiProvider();
            console.log("📱 SMS provider: Termii");
        } else {
            // Development — mock provider, just logs
            this.provider = {
                send: async (options: SendSmsOptions) => {
                    const numbers = Array.isArray(options.to)
                        ? options.to.join(", ")
                        : options.to;

                    console.log("📱 [SMS Mock]");
                    console.log(`   To:      ${numbers}`);
                    console.log(`   Message: ${options.message}`);
                },
            };
            console.log("📱 SMS provider: Mock (development)");
        }
    }

    // ── Generic send ─────────────────────────────────────────────────────
    async send(options: SendSmsOptions): Promise<void> {
        await this.provider.send(options);
    }

    // ── OTP ──────────────────────────────────────────────────────────────
    async sendOtp(params: {
        to:        string;
        otp:       string;
        expiresIn: string;
        type:      "email_verification" | "password_reset" | "two_factor";
    }): Promise<void> {
        const messages = {
            email_verification: `Your SchoolPortal verification code is: ${params.otp}. Expires in ${params.expiresIn}. Do not share.`,
            password_reset:     `Your SchoolPortal password reset code is: ${params.otp}. Expires in ${params.expiresIn}. Do not share.`,
            two_factor:         `Your SchoolPortal login code is: ${params.otp}. Expires in ${params.expiresIn}. Do not share.`,
        };

        await this.send({
            to:      params.to,
            message: messages[params.type],
        });
    }

    // ── Fee reminder ─────────────────────────────────────────────────────
    async sendFeeReminder(params: {
        to:         string;
        firstName:  string;
        schoolName: string;
        amount:     string;
        dueDate:    string;
    }): Promise<void> {
        await this.send({
            to:      params.to,
            message: `Hi ${params.firstName}, you have an outstanding fee of ${params.amount} at ${params.schoolName} due on ${params.dueDate}. Please make payment to avoid penalty.`,
        });
    }

    // ── Payment confirmation ──────────────────────────────────────────────
    async sendPaymentConfirmation(params: {
        to:         string;
        firstName:  string;
        amount:     string;
        schoolName: string;
        reference:  string;
    }): Promise<void> {
        await this.send({
            to:      params.to,
            message: `Hi ${params.firstName}, your payment of ${params.amount} to ${params.schoolName} is confirmed. Ref: ${params.reference}. Thank you.`,
        });
    }

    // ── Report card ───────────────────────────────────────────────────────
    async sendReportCardNotice(params: {
        to:          string;
        firstName:   string;
        studentName: string;
        schoolName:  string;
        term:        string;
        portalUrl:   string;
    }): Promise<void> {
        await this.send({
            to:      params.to,
            message: `Hi ${params.firstName}, ${params.studentName}'s ${params.term} report card from ${params.schoolName} is ready. Login to view: ${params.portalUrl}`,
        });
    }

    // ── Invite ────────────────────────────────────────────────────────────
    async sendInvite(params: {
        to:         string;
        firstName:  string;
        schoolName: string;
        inviteUrl:  string;
    }): Promise<void> {
        await this.send({
            to:      params.to,
            message: `Hi ${params.firstName}, you've been invited to join ${params.schoolName} on SchoolPortal. Complete your registration: ${params.inviteUrl}`,
        });
    }

    // ── Broadcast ─────────────────────────────────────────────────────────
    async sendBroadcast(params: {
        to:      string[];
        message: string;
    }): Promise<void> {
        await this.send({
            to:      params.to,
            message: params.message,
        });
    }
}