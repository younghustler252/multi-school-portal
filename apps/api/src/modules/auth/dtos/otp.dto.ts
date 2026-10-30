import { z } from "zod";
import { emailField } from "./common";

const otpField = z.string().regex(/^\d{6}$/, "Code must be 6 digits");

export const VerifyEmailDto = z.object({
    email: emailField,
    otp:   otpField,
});

export const ResendOtpDto = z.object({
    email: emailField,
    type:  z.enum(["email_verification", "password_reset"]).default("email_verification"),
});

export { otpField };
export type VerifyEmailDtoType = z.infer<typeof VerifyEmailDto>;
export type ResendOtpDtoType   = z.infer<typeof ResendOtpDto>;
