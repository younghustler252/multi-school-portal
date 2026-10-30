import { baseTemplate } from "./base.template";

/*
|--------------------------------------------------------------------------
| OTP TEMPLATE
| Used for: email verification, password reset, 2FA
|--------------------------------------------------------------------------
*/

export interface OtpTemplateParams {
    firstName: string;
    otp:       string;
    expiresIn: string;
    type:      "email_verification" | "password_reset" | "two_factor";
}

const config = {
    email_verification: {
        subject: "Verify Your Email Address",
        title:   "Verify Your Email",
        message: "Use the code below to verify your email address.",
    },
    password_reset: {
        subject: "Reset Your Password",
        title:   "Password Reset",
        message: "Use the code below to reset your password.",
    },
    two_factor: {
        subject: "Your Login Code",
        title:   "Two-Factor Login",
        message: "Use the code below to complete your login.",
    },
};

export const otpTemplate = (
    params: OtpTemplateParams,
): { subject: string; html: string } => {
    const { subject, title, message } = config[params.type];

    const content = `
        <h2>${title}</h2>
        <p>Hi ${params.firstName},</p>
        <p>${message}</p>
        <div class="code-box">
            <span>${params.otp}</span>
        </div>
        <p>
            This code expires in <strong>${params.expiresIn}</strong>.
            Never share it with anyone.
        </p>
        <hr class="divider" />
        <p style="font-size:13px; color:#999;">
            If you did not request this, please ignore this email
            or contact support if you are concerned.
        </p>
    `;

    return {
        subject,
        html: baseTemplate({ title: subject, preheader: message, content }),
    };
};